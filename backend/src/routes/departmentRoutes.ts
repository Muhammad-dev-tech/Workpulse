import { Router, Response } from 'express';
import { departmentRepository, userRepository, auditRepository, notificationRepository } from '../repositories';
import { requireAuthentication, requirePermission, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

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
  const { name, code, description, responsibilities, requestTypes, taskTypes, managerId } = req.body;

  if (!name || !code) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Department name and code are required.' }
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

  const newDept = await departmentRepository.create(orgId, {
    name,
    code: code.toUpperCase(),
    description: description || `Operational department for ${name}`,
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
    await notificationRepository.create({
      userId: managerId,
      organizationId: orgId,
      title: 'Appointed Department Manager',
      message: `You have been appointed as the Department Manager for ${newDept.name} (${newDept.code}).`,
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
  const { name, code, description, responsibilities, requestTypes, taskTypes, managerId } = req.body;

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

// Assign Department Manager
router.post('/:id/assign-manager', requireAuthentication, requirePermission('department:manage'), async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id } = req.params;
  const { managerId } = req.body;

  if (!managerId) {
    res.status(400).json({ success: false, error: { code: 'MISSING_PARAM', message: 'managerId is required' } });
    return;
  }

  const targetUser = await userRepository.findById(managerId);
  if (!targetUser) {
    res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User to assign as manager was not found' } });
    return;
  }

  const updatedDept = await departmentRepository.assignManager(orgId, id, targetUser.id, targetUser.name);
  if (!updatedDept) {
    res.status(404).json({ success: false, error: { code: 'DEPARTMENT_NOT_FOUND', message: 'Department was not found' } });
    return;
  }

  // Update user in store
  await userRepository.updateRoleAndDepartment(targetUser.id, 'MANAGER', updatedDept.id);

  // Send notification
  await notificationRepository.create({
    userId: targetUser.id,
    organizationId: orgId,
    title: 'Department Manager Assignment',
    message: `You are now the Department Manager of ${updatedDept.name}.`,
    type: 'SYSTEM',
    read: false
  });

  // Log audit
  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'MANAGER_ASSIGNED',
    'Department',
    updatedDept.id,
    { managerId: targetUser.id, managerName: targetUser.name, department: updatedDept.name }
  );

  res.json({ success: true, data: updatedDept });
});

export default router;
