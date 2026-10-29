import { Router, Response } from 'express';
import { taskRepository, requestRepository, userRepository, auditRepository, notificationRepository } from '../repositories';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// List tasks with RBAC and department scoping
router.get('/', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { departmentId, requestId, status, myOnly } = req.query;

  let filters: any = {};
  if (status) filters.status = String(status);
  if (requestId) filters.requestId = String(requestId);

  if (user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN' || user.role === 'DEAN') {
    // Executive and Dean tiers are governance and approval authorities, excluded from operational task queues.
    // If inspecting subtasks of a specific request or department, allow viewing:
    if (requestId) {
      // Allow inspection of request subtasks
    } else if (departmentId) {
      filters.departmentId = String(departmentId);
    } else {
      // General task view returns empty for executives; operational work belongs to unit heads & staff
      res.json({ success: true, data: [] });
      return;
    }
  } else if (user.role === 'MANAGER') {
    // Manager sees tasks in their assigned department or assigned to them
    if (departmentId && departmentId !== user.departmentId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot view tasks from another department.' }
      });
      return;
    }
    filters.departmentId = user.departmentId;
    if (myOnly === 'true') filters.assigneeId = user.id;
  } else {
    // Employee sees only their own assigned tasks
    filters.assigneeId = user.id;
  }

  const tasks = await taskRepository.findAll(orgId, filters);
  res.json({ success: true, data: tasks });
});

// Create task for a request
router.post('/', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { requestId, title, description, taskType, assigneeId, dueDate } = req.body;

  if (!requestId || !title || !assigneeId) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'requestId, title, and assigneeId are required.' }
    });
    return;
  }

  const request = await requestRepository.findByRequestId(orgId, requestId);
  if (!request) {
    res.status(404).json({ success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } });
    return;
  }

  // Check authorization to assign tasks in this department
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Employees cannot assign tasks.' } });
    return;
  }
  if (user.role === 'MANAGER' && user.departmentId !== request.departmentId) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You can only assign tasks for requests within your department.' }
    });
    return;
  }

  const assignee = await userRepository.findById(assigneeId);
  if (!assignee) {
    res.status(404).json({ success: false, error: { code: 'ASSIGNEE_NOT_FOUND', message: 'Assignee not found.' } });
    return;
  }

  if (user.role === 'MANAGER') {
    if (assignee.id === user.id) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ASSIGNEE', message: 'You cannot assign a task to yourself. Select a staff member in your department.' }
      });
      return;
    }
    if (assignee.departmentId !== request.departmentId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ASSIGNEE', message: 'Tasks can only be assigned to staff within this department.' }
      });
      return;
    }
  }

  const newTask = await taskRepository.create({
    requestId: request.requestId,
    requestTitle: request.title,
    organizationId: orgId,
    departmentId: request.departmentId,
    title,
    description: description || '',
    taskType: taskType || 'General Task',
    assigneeId: assignee.id,
    assigneeName: assignee.name,
    createdById: user.id,
    createdByName: user.name,
    status: 'TODO',
    dueDate
  });

  // Record timeline event on request
  await requestRepository.addTimelineEvent(orgId, request.requestId, {
    actorId: user.id,
    actorName: user.name,
    eventType: 'TASK_ASSIGNED',
    title: `Task Assigned: ${newTask.taskId}`,
    details: `Assigned "${newTask.title}" to ${assignee.name}.`
  });

  // Notify assignee
  await notificationRepository.create({
    userId: assignee.id,
    organizationId: orgId,
    title: 'New Task Assigned',
    message: `Manager ${user.name} assigned task ${newTask.taskId} ("${newTask.title}") to you for ${request.requestId}.`,
    type: 'TASK',
    link: request.requestId,
    read: false
  });

  // Log audit
  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'TASK_ASSIGNED',
    'Task',
    newTask.taskId,
    { requestId: request.requestId, assigneeId: assignee.id, assigneeName: assignee.name, title: newTask.title }
  );

  res.status(201).json({ success: true, data: newTask });
});

// Update task status and resolution notes
router.patch('/:id', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id } = req.params;
  const { status, resultNotes } = req.body;

  const task = await taskRepository.findById(orgId, id);
  if (!task) {
    res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' } });
    return;
  }

  // Authorization: Assignee, Manager of department, or Admin
  const isAssignee = task.assigneeId === user.id;
  const isDeptManager = user.role === 'MANAGER' && user.departmentId === task.departmentId;
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';

  if (!isAssignee && !isDeptManager && !isAdmin) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not have permission to update this task.' }
    });
    return;
  }

  const updates: any = {};
  if (status) {
    updates.status = status;
    if (status === 'COMPLETED') {
      updates.completedAt = new Date().toISOString();
    }
  }
  if (resultNotes !== undefined) updates.resultNotes = resultNotes;

  const updatedTask = await taskRepository.update(orgId, id, updates);

  // If completed, add timeline event to request and notify manager
  if (status === 'COMPLETED') {
    await requestRepository.addTimelineEvent(orgId, task.requestId, {
      actorId: user.id,
      actorName: user.name,
      eventType: 'TASK_COMPLETED',
      title: `Task Completed: ${task.taskId}`,
      details: `${user.name} completed "${task.title}". Notes: ${resultNotes || 'Work finished successfully.'}`
    });

    // Notify manager that task is finished
    await notificationRepository.create({
      userId: task.createdById,
      organizationId: orgId,
      title: 'Task Completed',
      message: `${user.name} completed task ${task.taskId} for ${task.requestId}. Ready for verification.`,
      type: 'TASK',
      link: task.requestId,
      read: false
    });
  }

  // Audit log
  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'TASK_STATUS_UPDATED',
    'Task',
    task.taskId,
    { newStatus: status, resultNotes }
  );

  res.json({ success: true, data: updatedTask });
});

export default router;
