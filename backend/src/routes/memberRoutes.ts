import { Router, Response } from 'express';
import {
  userRepository,
  departmentRepository,
  organizationRepository,
  auditRepository,
  notificationRepository
} from '../repositories';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/auth';
import { getTerminology } from '../config/terminology';
import { UserRole } from '../types';

const router = Router();

/**
 * GET /api/members
 * Returns all members of the caller's organization with department details.
 */
router.get('/', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const [users, depts] = await Promise.all([
      userRepository.findAll(orgId),
      departmentRepository.findAll(orgId)
    ]);

    const deptMap = new Map(depts.map(d => [d.id, d]));

    const members = users.map(u => {
      const dept = u.departmentId ? deptMap.get(u.departmentId) : undefined;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        departmentId: u.departmentId || null,
        departmentName: dept?.name || null,
        departmentCode: dept?.code || null,
        faculty: u.faculty || dept?.faculty || null,
        avatarUrl: u.avatarUrl || null,
        organizationId: u.organizationId,
        createdAt: u.createdAt
      };
    });

    res.json({ success: true, data: members });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_MEMBERS_FAILED', message: err.message || 'Failed to list members.' }
    });
  }
});

/**
 * PUT /api/members/:id/role
 * Org Admin (or Super Admin) appoints a representative or alters member role/department.
 */
router.put('/:id/role', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caller = req.user!;
    const orgId = req.organizationId!;
    const targetUserId = req.params.id;
    const { role, departmentId, faculty } = req.body;

    // Authorization check: Only ORG_ADMIN or SUPER_ADMIN can appoint roles
    if (caller.role !== 'ORG_ADMIN' && caller.role !== 'SUPER_ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only Organization Administrators or Super Admins can appoint roles.' }
      });
      return;
    }

    const validRoles: UserRole[] = ['ORG_ADMIN', 'DEAN', 'MANAGER', 'OPERATOR', 'EMPLOYEE'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: `Invalid role specified. Valid roles are: ${validRoles.join(', ')}` }
      });
      return;
    }

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Target member was not found.' }
      });
      return;
    }

    // Load terminology for validation messages & notifications
    const org = await organizationRepository.findById(orgId);
    const terms = getTerminology(org?.orgType);
    const appointedRole = role as UserRole;
    const roleTitle = terms.roles[appointedRole] || appointedRole;

    // Self-appointment guard
    if (caller.id === targetUserId) {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_SELF_APPOINT', message: 'You cannot alter your own organizational leadership position. Appointments are made for other organization members.' }
      });
      return;
    }

    // Tenant boundary check
    if (caller.role !== 'SUPER_ADMIN' && targetUser.organizationId !== orgId) {
      res.status(403).json({
        success: false,
        error: { code: 'CROSS_TENANT_FORBIDDEN', message: 'Cannot modify a member of another organization.' }
      });
      return;
    }

    // Platform Super Admin protection
    if (targetUser.email === 'admin@acme.com' && role !== 'SUPER_ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'IMMUTABLE_SUPERADMIN', message: 'The platform Super Admin account cannot be altered or demoted.' }
      });
      return;
    }

    // Non-superadmins cannot alter an existing Org Admin or assign Org Admin / Super Admin
    if (caller.role !== 'SUPER_ADMIN' && targetUser.role === 'ORG_ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only Platform Super Admins can alter an Organization Administrator.' }
      });
      return;
    }

    if (caller.role !== 'SUPER_ADMIN' && (role === 'SUPER_ADMIN' || role === 'ORG_ADMIN')) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only Platform Super Admins can assign Organization Administrator or Super Admin privileges.' }
      });
      return;
    }

    // Strict Assignment Rules:
    // 1. Appointing as HOD (MANAGER) requires an assigned department
    if (role === 'MANAGER' && !departmentId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'DEPARTMENT_REQUIRED_FOR_HOD',
          message: `Assigning a ${terms.unit} is mandatory when appointing a ${terms.roles.MANAGER}. Please select a destination ${terms.unit.toLowerCase()}.`
        }
      });
      return;
    }

    // 2. Appointing as Dean (DEAN) requires an assigned faculty/division
    if (role === 'DEAN' && (!faculty || !String(faculty).trim())) {
      res.status(400).json({
        success: false,
        error: {
          code: 'FACULTY_REQUIRED_FOR_DEAN',
          message: `Assigning a ${terms.division} is mandatory when appointing a ${terms.roles.DEAN}. Please enter or select a ${terms.division.toLowerCase()}.`
        }
      });
      return;
    }

    const cleanFaculty = faculty !== undefined ? (String(faculty).trim() || undefined) : targetUser.faculty;
    const effectiveDeptId = departmentId !== undefined ? (departmentId || undefined) : targetUser.departmentId;

    // Update in user repository
    const updatedUser = await userRepository.updateRoleAndDepartment(targetUserId, role, effectiveDeptId, cleanFaculty);
    if (!updatedUser) {
      res.status(500).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update member role.' }
      });
      return;
    }

    // Handle leadership transitions:
    // If user previously held MANAGER and is now stepped down / promoted to another role, vacate previous department
    if (targetUser.role === 'MANAGER' && role !== 'MANAGER' && targetUser.departmentId) {
      await departmentRepository.vacateManager(orgId, targetUser.departmentId);
    }

    // If appointing new Dean, transition former Dean of this faculty to regular EMPLOYEE
    if (role === 'DEAN' && cleanFaculty) {
      const allUsers = await userRepository.findAll(orgId);
      const prevDean = allUsers.find(u => u.id !== targetUser.id && u.role === 'DEAN' && u.faculty && u.faculty.toLowerCase().trim() === cleanFaculty.toLowerCase());
      if (prevDean) {
        await userRepository.updateRoleAndDepartment(prevDean.id, 'EMPLOYEE', prevDean.departmentId, cleanFaculty);
        await notificationRepository.create({
          userId: prevDean.id,
          organizationId: orgId,
          title: `${terms.roles.DEAN} Tenure Concluded`,
          message: `Your tenure as ${terms.roles.DEAN} of ${cleanFaculty} has concluded. You are now designated as ${terms.roles.EMPLOYEE}.`,
          type: 'SYSTEM',
          read: false
        });
      }
    }

    // If appointed as MANAGER to a department, assign as manager in the department record (will automatically transition previous manager)
    let assignedDeptName = '';
    if (effectiveDeptId) {
      const dept = await departmentRepository.findById(orgId, effectiveDeptId);
      if (dept) {
        assignedDeptName = dept.name;
        if (role === 'MANAGER') {
          await departmentRepository.assignManager(orgId, effectiveDeptId, targetUser.id, targetUser.name);
        }
      }
    }

    // Notify member of appointment
    try {
      const assignedContext = role === 'DEAN'
        ? (cleanFaculty ? ` for ${cleanFaculty}` : '')
        : (assignedDeptName ? ` for ${assignedDeptName}` : '');

      await notificationRepository.create({
        userId: targetUser.id,
        organizationId: orgId,
        title: `Appointed as ${roleTitle}`,
        message: `You have been appointed as ${roleTitle}${assignedContext} by ${caller.name}. Your dashboard and access rights are now active.`,
        type: 'SYSTEM',
        read: false
      });
    } catch {}

    // Log in audit trail
    try {
      await auditRepository.log(
        orgId,
        { id: caller.id, name: caller.name, role: caller.role },
        'MEMBER_ROLE_APPOINTED',
        'User',
        targetUser.id,
        {
          targetEmail: targetUser.email,
          targetName: targetUser.name,
          previousRole: targetUser.role,
          appointedRole: role,
          roleTitle,
          departmentId: effectiveDeptId,
          departmentName: assignedDeptName,
          faculty: cleanFaculty
        }
      );
    } catch {}

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        departmentId: updatedUser.departmentId || null,
        departmentName: assignedDeptName || null,
        faculty: updatedUser.faculty || cleanFaculty || null,
        avatarUrl: updatedUser.avatarUrl || null,
        organizationId: updatedUser.organizationId
      },
      message: `Member successfully appointed as ${roleTitle}.`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'APPOINT_FAILED', message: err.message || 'Failed to appoint role.' }
    });
  }
});

export default router;
