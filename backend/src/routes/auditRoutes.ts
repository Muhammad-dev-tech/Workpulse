import { Router, Response } from 'express';
import { auditRepository, departmentRepository, requestRepository, userRepository } from '../repositories';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/auth';
import { getFacultyForDean } from './departmentRoutes';

const router = Router();

router.get('/', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { limit, actorId, resourceType } = req.query;

  // Authorization check: Only Admins, Deans, and Managers can inspect audit trail
  if (user.role === 'EMPLOYEE' || user.role === 'OPERATOR') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Audit logs are restricted to Managers, Deans, and Executive Administrators.' }
    });
    return;
  }

  // Fetch base logs for the tenant
  const rawLogs = await auditRepository.findAll(orgId, {
    actorId: actorId ? String(actorId) : undefined,
    resourceType: resourceType ? String(resourceType) : undefined,
    limit: limit ? Number(limit) : 250
  });

  // 1. Platform Super Admin & Institution Vice-Chancellor (ORG_ADMIN):
  //    Full institutional oversight across all faculties, departments, central units, and settings.
  if (user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN') {
    res.json({
      success: true,
      data: rawLogs,
      scope: {
        type: 'ALL',
        label: 'Institution-Wide Executive Oversight'
      }
    });
    return;
  }

  // 2. Dean: Strictly scoped to governance, departments, requests, and personnel under their Faculty.
  if (user.role === 'DEAN') {
    const rawFaculty = getFacultyForDean(orgId, user.id, user.faculty);
    const facultyName = (rawFaculty || '').toLowerCase().trim();

    // Collect all departments under this faculty
    const departments = await departmentRepository.findAll(orgId);
    const facultyDepts = departments.filter(d => (d.faculty || '').toLowerCase().trim() === facultyName);
    const facultyDeptIds = new Set(facultyDepts.map(d => d.id));

    // Collect all requests originating from or assigned to these departments
    const requests = await requestRepository.findAll(orgId);
    const facultyRequestIds = new Set(
      requests
        .filter(r => facultyDeptIds.has(r.departmentId))
        .map(r => r.id)
    );

    // Collect all faculty member IDs
    const users = await userRepository.findAll(orgId);
    const facultyMemberIds = new Set(
      users
        .filter(u => 
          u.id === user.id ||
          (u.faculty && u.faculty.toLowerCase().trim() === facultyName) ||
          (u.departmentId && facultyDeptIds.has(u.departmentId))
        )
        .map(u => u.id)
    );

    // Filter logs strictly belonging to the Dean's faculty
    const facultyScopedLogs = rawLogs.filter(log => {
      // Performed by the Dean or someone in their faculty
      if (facultyMemberIds.has(log.actorId)) return true;

      // Resource is a Department under this faculty
      if (log.resourceType === 'Department' && facultyDeptIds.has(log.resourceId)) return true;

      // Resource is the Faculty itself
      if (log.resourceType === 'Faculty') {
        const targetFac = String(log.resourceId || '').toLowerCase().trim();
        const detailFac = String(log.details?.faculty || log.details?.name || '').toLowerCase().trim();
        if (targetFac.includes(facultyName) || detailFac.includes(facultyName)) return true;
      }

      // Resource is a Request belonging to this faculty
      if (log.resourceType === 'Request') {
        if (facultyRequestIds.has(log.resourceId)) return true;
        if (log.details?.departmentId && facultyDeptIds.has(log.details.departmentId)) return true;
        if (log.details?.faculty && String(log.details.faculty).toLowerCase().trim() === facultyName) return true;
      }

      // Resource is a Task for a request in this faculty
      if (log.resourceType === 'Task') {
        if (log.details?.requestId && facultyRequestIds.has(log.details.requestId)) return true;
        if (log.details?.departmentId && facultyDeptIds.has(log.details.departmentId)) return true;
      }

      // User appointment or role change in this faculty
      if (log.resourceType === 'User') {
        if (facultyMemberIds.has(log.resourceId)) return true;
        if (log.details?.faculty && String(log.details.faculty).toLowerCase().trim() === facultyName) return true;
        if (log.details?.departmentId && facultyDeptIds.has(log.details.departmentId)) return true;
      }

      // General details reference to the faculty name or department
      if (log.details) {
        const detailsStr = JSON.stringify(log.details).toLowerCase();
        if (facultyName && detailsStr.includes(`"${facultyName}"`)) return true;
        for (const deptId of facultyDeptIds) {
          if (detailsStr.includes(`"${deptId}"`)) return true;
        }
      }

      return false;
    });

    res.json({
      success: true,
      data: facultyScopedLogs,
      scope: {
        type: 'FACULTY',
        faculty: rawFaculty,
        label: `${rawFaculty || 'Faculty'} Governance Trail`
      }
    });
    return;
  }

  // 3. Manager / Head of Department: Strictly scoped to actions within their assigned Department.
  if (user.role === 'MANAGER' && user.departmentId) {
    const deptId = user.departmentId;
    const deptScopedLogs = rawLogs.filter(log => {
      if (log.actorId === user.id) return true;
      if (log.resourceType === 'Department' && log.resourceId === deptId) return true;
      if (log.details?.departmentId === deptId) return true;
      if (log.details && JSON.stringify(log.details).includes(deptId)) return true;
      return false;
    });

    res.json({
      success: true,
      data: deptScopedLogs,
      scope: {
        type: 'DEPARTMENT',
        departmentId: deptId,
        label: 'Department Operational Trail'
      }
    });
    return;
  }

  // Fallback for any other authorized role
  res.json({ success: true, data: rawLogs });
});

export default router;
