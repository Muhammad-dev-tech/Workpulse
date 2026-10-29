import { Router, Response } from 'express';
import { departmentRepository, userRepository, auditRepository, notificationRepository, organizationRepository } from '../repositories';
import { requireAuthentication, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { getTerminology } from '../config/terminology';

const router = Router();

const loadTerms = async (orgId: string) => {
  const org = await organizationRepository.findById(orgId);
  return getTerminology(org?.orgType);
};

interface RegisteredFaculty {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  deanId?: string;
  createdAt: string;
}

export const registeredFaculties: RegisteredFaculty[] = [];

export function getFacultyForDean(orgId: string, userId: string, currentFaculty?: string): string | undefined {
  if (currentFaculty && currentFaculty.trim()) return currentFaculty.trim();
  const reg = registeredFaculties.find(f => f.organizationId === orgId && f.deanId === userId);
  if (reg) return reg.name;
  return undefined;
}

// List all faculties/divisions in organization
router.get('/faculties', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const terms = await loadTerms(orgId);
  const departments = await departmentRepository.findAll(orgId);
  const users = await userRepository.findAll(orgId);

  // Collect distinct faculty names from registered, departments, and deans
  const facultyNamesSet = new Set<string>();

  registeredFaculties
    .filter(f => f.organizationId === orgId)
    .forEach(f => facultyNamesSet.add(f.name));

  departments
    .filter(d => d.faculty && d.faculty.trim())
    .forEach(d => facultyNamesSet.add(d.faculty!.trim()));

  users
    .filter(u => u.role === 'DEAN' && u.faculty && u.faculty.trim())
    .forEach(u => facultyNamesSet.add(u.faculty!.trim()));

  const faculties = Array.from(facultyNamesSet).map(name => {
    const reg = registeredFaculties.find(f => f.organizationId === orgId && f.name.toLowerCase() === name.toLowerCase());
    const depts = departments.filter(d => d.faculty && d.faculty.toLowerCase() === name.toLowerCase());
    const dean = (reg?.deanId ? users.find(u => u.id === reg.deanId) : undefined) ||
      users.find(u => u.role === 'DEAN' && u.faculty && u.faculty.toLowerCase() === name.toLowerCase()) ||
      users.find(u => u.role === 'DEAN');

    const code = reg?.code || name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);

    return {
      id: reg?.id || `fac-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      organizationId: orgId,
      name,
      code,
      description: reg?.description || `${terms.division} overseeing ${depts.length} ${terms.unit.toLowerCase()}s`,
      deanId: dean?.id,
      deanName: dean?.name,
      departmentCount: depts.length,
      departments: depts.map(d => ({
        id: d.id,
        name: d.name,
        code: d.code,
        approvalPolicy: d.approvalPolicy,
        managerName: d.managerName
      })),
      createdAt: reg?.createdAt || new Date().toISOString()
    };
  });

  res.json({ success: true, data: faculties });
});

// Create new faculty/division
router.post('/faculties', requireAuthentication, requirePermission('department:manage'), async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const terms = await loadTerms(orgId);
  const { name, code, description, deanId } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: `${terms.division} name is required.` }
    });
    return;
  }

  const trimmedName = name.trim();
  const existing = registeredFaculties.find(
    f => f.organizationId === orgId && f.name.toLowerCase() === trimmedName.toLowerCase()
  );

  let deanName: string | undefined = undefined;
  if (deanId) {
    const targetUser = await userRepository.findById(deanId);
    if (targetUser) {
      deanName = targetUser.name;
      // Appoint as DEAN and bind to this faculty
      await userRepository.updateRoleAndDepartment(deanId, 'DEAN', undefined, trimmedName);

      await notificationRepository.create({
        userId: deanId,
        organizationId: orgId,
        title: `Appointed as ${terms.roles.DEAN}`,
        message: `You have been appointed as the ${terms.roles.DEAN} of ${trimmedName}.`,
        type: 'SYSTEM',
        read: false
      });
    }
  }

  const facultyRecord: RegisteredFaculty = {
    id: existing?.id || `fac-${Date.now()}-${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    organizationId: orgId,
    name: trimmedName,
    code: code ? code.trim().toUpperCase() : trimmedName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 4),
    description: description ? description.trim() : undefined,
    deanId: deanId || existing?.deanId,
    createdAt: existing?.createdAt || new Date().toISOString()
  };

  if (existing) {
    existing.code = facultyRecord.code;
    existing.description = facultyRecord.description;
    existing.deanId = facultyRecord.deanId;
  } else {
    registeredFaculties.push(facultyRecord);
  }

  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'FACULTY_CREATED',
    'Faculty',
    facultyRecord.id,
    { name: trimmedName, code: facultyRecord.code, deanId, deanName }
  );

  res.status(201).json({
    success: true,
    data: {
      ...facultyRecord,
      deanName,
      departmentCount: 0,
      departments: []
    }
  });
});

// List all departments in organization
router.get('/', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const departments = await departmentRepository.findAll(orgId);
  res.json({ success: true, data: departments });
});

// Get single department configuration
router.get('/:id', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const dept = await departmentRepository.findById(orgId, req.params.id);
  if (!dept) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Department not found' } });
    return;
  }
  res.json({ success: true, data: dept });
});

// Administrative Department Setup: Create New Department
router.post('/', requireAuthentication, requirePermission('department:manage'), async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { name, code, description, responsibilities, requestTypes, taskTypes, managerId, faculty, approvalPolicy } = req.body;

  if (!name || !code) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Department name and code are required.' }
    });
    return;
  }

  if (!faculty || !String(faculty).trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'FACULTY_REQUIRED', message: 'Each department must belong to a designated faculty.' }
    });
    return;
  }

  // Validate manager if provided
  let managerName: string | undefined = undefined;
  if (managerId) {
    const mgrUser = await userRepository.findById(managerId);
    if (!mgrUser) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_MANAGER', message: 'Selected manager user does not exist.' }
      });
      return;
    }
    managerName = mgrUser.name;
  }

  const validPolicies = ['DIRECT', 'DEPT_MANAGER', 'DEAN', 'EXECUTIVE_ONLY', 'MULTI_TIER_CHAIN'];
  const effectivePolicy = validPolicies.includes(approvalPolicy)
    ? approvalPolicy
    : (approvalPolicy === 'APPROVAL_REQUIRED' ? 'DEPT_MANAGER' : 'DIRECT');

  const newDept = await departmentRepository.create(orgId, {
    name,
    code: code.toUpperCase(),
    description: description || `Operational department for ${name}`,
    faculty: faculty ? String(faculty).trim() : undefined,
    approvalPolicy: effectivePolicy as any,
    requiresApproval: effectivePolicy !== 'DIRECT',
    managerId,
    managerName,
    responsibilities: Array.isArray(responsibilities) ? responsibilities : [],
    requestTypes: Array.isArray(requestTypes) ? requestTypes : [],
    taskTypes: Array.isArray(taskTypes) ? taskTypes : [],
    employeeIds: []
  });

  // If manager assigned, update manager's user record in backend
  if (managerId && managerName) {
    await userRepository.updateRoleAndDepartment(managerId, 'MANAGER', newDept.id);

    // Notify newly assigned manager
    const terms = await loadTerms(orgId);
    await notificationRepository.create({
      userId: managerId,
      organizationId: orgId,
      title: `Appointed as ${terms.roles.MANAGER}`,
      message: `You have been appointed as the ${terms.roles.MANAGER} for ${newDept.name} (${newDept.code}).`,
      type: 'SYSTEM',
      read: false
    });
  }

  // Log audit event
  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'DEPARTMENT_CREATED',
    'Department',
    newDept.id,
    {
      name: newDept.name,
      code: newDept.code,
      faculty: newDept.faculty,
      approvalPolicy: newDept.approvalPolicy,
      managerId,
      managerName,
      responsibilities: newDept.responsibilities,
      requestTypesCount: newDept.requestTypes.length,
      taskTypesCount: newDept.taskTypes.length
    }
  );

  res.status(201).json({ success: true, data: newDept });
});

// Update Department Configuration
router.put('/:id', requireAuthentication, requirePermission('department:manage'), async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id } = req.params;
  const { name, code, description, responsibilities, requestTypes, taskTypes, managerId, faculty, approvalPolicy } = req.body;

  const existing = await departmentRepository.findById(orgId, id);
  if (!existing) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Department not found' } });
    return;
  }

  let managerName = existing.managerName;
  if (managerId && managerId !== existing.managerId) {
    const mgrUser = await userRepository.findById(managerId);
    if (mgrUser) {
      managerName = mgrUser.name;
      await userRepository.updateRoleAndDepartment(managerId, 'MANAGER', existing.id);
    }
  }

  const updated = await departmentRepository.update(orgId, id, {
    ...(name ? { name } : {}),
    ...(code ? { code: code.toUpperCase() } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(faculty !== undefined ? { faculty: faculty ? String(faculty).trim() : undefined } : {}),
    ...(approvalPolicy !== undefined ? {
      approvalPolicy,
      requiresApproval: approvalPolicy !== 'DIRECT'
    } : {}),
    ...(responsibilities ? { responsibilities } : {}),
    ...(requestTypes ? { requestTypes } : {}),
    ...(taskTypes ? { taskTypes } : {}),
    ...(managerId !== undefined ? { managerId, managerName } : {})
  });

  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'DEPARTMENT_UPDATED',
    'Department',
    id,
    { name: updated?.name, managerId, managerName }
  );

  res.json({ success: true, data: updated });
});

// Reassign or Vacate Department Manager (HOD) - handles promotion, retirement, and tenure turnover
router.post('/:id/assign-manager', requireAuthentication, requirePermission('department:manage'), async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id } = req.params;
  const { managerId } = req.body;
  const terms = await loadTerms(orgId);

  const dept = await departmentRepository.findById(orgId, id);
  if (!dept) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Department not found' } });
    return;
  }

  // Dean authorization check: If caller is a Dean, they can only manage departments in their faculty
  if (user.role === 'DEAN' && dept.faculty && user.faculty && dept.faculty.toLowerCase().trim() !== user.faculty.toLowerCase().trim()) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Deans can only manage departments under their assigned faculty.' } });
    return;
  }

  const prevManagerId = dept.managerId;

  // Case 1: Vacating HOD (Step down / Retirement without immediate successor)
  if (!managerId) {
    const updatedDept = await departmentRepository.vacateManager(orgId, id);
    if (prevManagerId) {
      await notificationRepository.create({
        userId: prevManagerId,
        organizationId: orgId,
        title: `${terms.roles.MANAGER} Tenure Concluded`,
        message: `Your tenure as ${terms.roles.MANAGER} for ${dept.name} has concluded. You are now designated as ${terms.roles.EMPLOYEE}.`,
        type: 'SYSTEM',
        read: false
      });
    }

    await auditRepository.log(
      orgId,
      { id: user.id, name: user.name, role: user.role },
      'MANAGER_VACATED',
      'Department',
      id,
      { previousManagerId: prevManagerId, department: dept.name }
    );

    res.json({ success: true, data: updatedDept, message: `${terms.roles.MANAGER} position has been vacated.` });
    return;
  }

  // Case 2: Appointing New HOD (Promotion / Reassignment)
  const targetUser = await userRepository.findById(managerId);
  if (!targetUser) {
    res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User to appoint was not found.' } });
    return;
  }

  const updatedDept = await departmentRepository.assignManager(orgId, id, targetUser.id, targetUser.name);

  // Notify newly appointed HOD
  await notificationRepository.create({
    userId: targetUser.id,
    organizationId: orgId,
    title: `Appointed as ${terms.roles.MANAGER}`,
    message: `You have been appointed as ${terms.roles.MANAGER} for ${dept.name} (${dept.code}) by ${user.name}.`,
    type: 'SYSTEM',
    read: false
  });

  // If previous manager existed and was different, notify them
  if (prevManagerId && prevManagerId !== targetUser.id) {
    await notificationRepository.create({
      userId: prevManagerId,
      organizationId: orgId,
      title: `${terms.roles.MANAGER} Tenure Concluded`,
      message: `Your tenure as ${terms.roles.MANAGER} for ${dept.name} has concluded. You have transitioned to regular ${terms.roles.EMPLOYEE}.`,
      type: 'SYSTEM',
      read: false
    });
  }

  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'MANAGER_ASSIGNED',
    'Department',
    updatedDept!.id,
    { newManagerId: targetUser.id, newManagerName: targetUser.name, previousManagerId: prevManagerId, department: updatedDept!.name }
  );

  res.json({ success: true, data: updatedDept, message: `Successfully appointed ${targetUser.name} as ${terms.roles.MANAGER}.` });
});

// Reassign or Vacate Faculty Dean - handles promotion, retirement, and tenure turnover
router.post('/faculties/:name/assign-dean', requireAuthentication, requirePermission('organization:manage'), async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const facultyName = decodeURIComponent(req.params.name).trim();
  const { deanId } = req.body;
  const terms = await loadTerms(orgId);

  // Find all users in org to locate current Dean of this faculty
  const allUsers = await userRepository.findAll(orgId);
  const prevDean = allUsers.find(u => u.role === 'DEAN' && u.faculty && u.faculty.toLowerCase().trim() === facultyName.toLowerCase());

  // Case 1: Vacating Dean
  if (!deanId) {
    if (prevDean) {
      await userRepository.updateRoleAndDepartment(prevDean.id, 'EMPLOYEE', prevDean.departmentId, facultyName);
      await notificationRepository.create({
        userId: prevDean.id,
        organizationId: orgId,
        title: `${terms.roles.DEAN} Tenure Concluded`,
        message: `Your tenure as ${terms.roles.DEAN} of ${facultyName} has concluded. You have transitioned to ${terms.roles.EMPLOYEE}.`,
        type: 'SYSTEM',
        read: false
      });
    }

    const targetReg = registeredFaculties.find(
      f => f.organizationId === orgId && f.name.toLowerCase() === facultyName.toLowerCase()
    );
    if (targetReg) {
      targetReg.deanId = undefined;
    }

    await auditRepository.log(
      orgId,
      { id: user.id, name: user.name, role: user.role },
      'DEAN_VACATED',
      'Faculty',
      facultyName,
      { previousDeanId: prevDean?.id, facultyName }
    );

    res.json({ success: true, message: `${terms.roles.DEAN} of ${facultyName} has stepped down / position vacated.` });
    return;
  }

  // Case 2: Appointing New Dean
  const newDeanUser = await userRepository.findById(deanId);
  if (!newDeanUser) {
    res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User to appoint as Dean was not found.' } });
    return;
  }

  // If there was an existing Dean, demote to EMPLOYEE
  if (prevDean && prevDean.id !== newDeanUser.id) {
    await userRepository.updateRoleAndDepartment(prevDean.id, 'EMPLOYEE', prevDean.departmentId, facultyName);
    await notificationRepository.create({
      userId: prevDean.id,
      organizationId: orgId,
      title: `${terms.roles.DEAN} Tenure Concluded`,
      message: `Your tenure as ${terms.roles.DEAN} of ${facultyName} has concluded. You have transitioned to ${terms.roles.EMPLOYEE}.`,
      type: 'SYSTEM',
      read: false
    });
  }

  // Promote new user to DEAN
  await userRepository.updateRoleAndDepartment(newDeanUser.id, 'DEAN', newDeanUser.departmentId, facultyName);

  const targetReg = registeredFaculties.find(
    f => f.organizationId === orgId && f.name.toLowerCase() === facultyName.toLowerCase()
  );
  if (targetReg) {
    targetReg.deanId = newDeanUser.id;
  }

  await notificationRepository.create({
    userId: newDeanUser.id,
    organizationId: orgId,
    title: `Appointed as ${terms.roles.DEAN}`,
    message: `You have been appointed as the ${terms.roles.DEAN} of ${facultyName} by ${user.name}.`,
    type: 'SYSTEM',
    read: false
  });

  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'DEAN_ASSIGNED',
    'Faculty',
    facultyName,
    { newDeanId: newDeanUser.id, newDeanName: newDeanUser.name, previousDeanId: prevDean?.id, facultyName }
  );

  res.json({ success: true, message: `Successfully appointed ${newDeanUser.name} as ${terms.roles.DEAN} of ${facultyName}.` });
});

export default router;
