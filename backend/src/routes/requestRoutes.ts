import { Router, Response } from 'express';
import { requestRepository, departmentRepository, userRepository, auditRepository, notificationRepository, taskRepository } from '../repositories';
import {
  requireAuthentication,
  AuthenticatedRequest,
  canUserAccessRequest,
  canUserAccessDepartment
} from '../middleware/auth';

const router = Router();

// Pending Radar: Scoped Operational Statistics
router.get('/radar', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const allRequests = await requestRepository.findAll(orgId);

  // Filter requests based on user role and department scope
  let visibleRequests = allRequests;
  if (user.role === 'MANAGER') {
    visibleRequests = allRequests.filter(
      r => r.departmentId === user.departmentId || r.requesterId === user.id || r.assigneeId === user.id
    );
  } else if (user.role === 'EMPLOYEE' || user.role === 'OPERATOR') {
    visibleRequests = allRequests.filter(
      r => r.requesterId === user.id || r.assigneeId === user.id || (r.tasks && r.tasks.some(t => t.assigneeId === user.id))
    );
  }

  const now = new Date();
  const active = visibleRequests.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
  const overdue = active.filter(r => r.dueDate && new Date(r.dueDate) < now);
  const waiting = active.filter(r => r.status === 'WAITING' || !!r.waitingOn);
  const pendingApprovals = active.filter(r => r.status === 'PENDING_APPROVAL');
  const assignedToMe = active.filter(
    r => r.assigneeId === user.id || (r.tasks && r.tasks.some(t => t.assigneeId === user.id))
  );
  const createdByMe = active.filter(r => r.requesterId === user.id);
  const completedToday = visibleRequests.filter(r => {
    if (r.status !== 'COMPLETED' || !r.completedAt) return false;
    const compDate = new Date(r.completedAt);
    return compDate.toDateString() === now.toDateString();
  });

  // Department workload distribution (filtered for managers to their dept)
  const departments = await departmentRepository.findAll(orgId);
  const filteredDepartments = (user.role === 'MANAGER' && user.departmentId)
    ? departments.filter(d => d.id === user.departmentId)
    : departments;

  const departmentWorkload = filteredDepartments.map(d => {
    const deptReqs = active.filter(r => r.departmentId === d.id);
    return {
      id: d.id,
      name: d.name,
      code: d.code,
      totalActive: deptReqs.length,
      waiting: deptReqs.filter(r => r.status === 'WAITING' || !!r.waitingOn).length
    };
  });

  res.json({
    success: true,
    data: {
      totalActive: active.length,
      overdueCount: overdue.length,
      waitingCount: waiting.length,
      pendingApprovalCount: pendingApprovals.length,
      assignedToMeCount: assignedToMe.length,
      createdByMeCount: createdByMe.length,
      completedTodayCount: completedToday.length,
      departmentWorkload
    }
  });
});

// List Requests with Strict RBAC & Department Scoping
router.get('/', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { status, departmentId, isOverdue, isWaiting, myOnly } = req.query;

  // Strict Backend Department Scope Check
  if (departmentId && typeof departmentId === 'string') {
    if (!canUserAccessDepartment(user, departmentId)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_DEPARTMENT',
          message: `Access denied. You do not have permission to view operational data for this department.`
        }
      });
      return;
    }
  }

  let filterOpts: any = {};
  if (status) filterOpts.status = String(status);
  if (departmentId) filterOpts.departmentId = String(departmentId);
  if (isOverdue === 'true') filterOpts.isOverdue = true;
  if (isWaiting === 'true') filterOpts.isWaiting = true;

  if (myOnly === 'true' || user.role === 'EMPLOYEE') {
    filterOpts.requesterId = user.id;
  } else if (user.role === 'MANAGER' && !departmentId) {
    // By default, department manager sees their department
    filterOpts.departmentId = user.departmentId;
  }

  const rawRequests = await requestRepository.findAll(orgId, filterOpts);
  
  // Double-check resource access on the result set
  const requests = rawRequests.filter(r => canUserAccessRequest(user, r));
  res.json({ success: true, data: requests });
});

// Get Single Request Details with strict authorization check
router.get('/:id', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id } = req.params;

  const request = await requestRepository.findById(orgId, id);
  if (!request) {
    res.status(404).json({
      success: false,
      error: { code: 'REQUEST_NOT_FOUND', message: `Request '${id}' could not be found.` }
    });
    return;
  }

  // Backend Security Boundary Check
  if (!canUserAccessRequest(user, request)) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access Denied: You do not have permission to view this request belonging to another department.'
      }
    });
    return;
  }

  res.json({ success: true, data: request });
});

// Create Request
router.post('/', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const user = req.user!;
    const { title, description, priority, departmentId, requestTypeId, workflowTemplateId, dueDate, approvalPolicy } = req.body;

    if (!title || !description || !departmentId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title, description, and department are required.' }
      });
      return;
    }

    const dept = await departmentRepository.findById(orgId, departmentId);
    if (!dept) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_DEPARTMENT', message: 'Selected department does not exist.' }
      });
      return;
    }

    const reqType = dept.requestTypes.find(rt => rt.id === requestTypeId);
    const isGovernanceKeyword = reqType?.name?.toLowerCase().includes('approval') ||
      reqType?.name?.toLowerCase().includes('access') ||
      reqType?.name?.toLowerCase().includes('rectif') ||
      reqType?.name?.toLowerCase().includes('portal') ||
      title?.toLowerCase().includes('rectif') ||
      title?.toLowerCase().includes('portal') ||
      title?.toLowerCase().includes('approval');

    const policy = approvalPolicy || reqType?.approvalPolicy || (reqType?.requiresApproval || isGovernanceKeyword ? 'EXECUTIVE_ONLY' : 'DIRECT');

    let initialStatus: 'SUBMITTED' | 'ACTIVE' | 'PENDING_APPROVAL' = 'ACTIVE';
    let initialStepName = 'Dispatched to Department Queue';

    if (policy === 'EXECUTIVE_ONLY' || policy === 'MULTI_TIER_CHAIN') {
      initialStatus = 'PENDING_APPROVAL';
      initialStepName = 'Awaiting Executive (Super Admin / VC / Director) Approval';
    } else if (policy === 'DEPT_MANAGER') {
      initialStatus = 'PENDING_APPROVAL';
      initialStepName = 'Awaiting Department Manager Approval';
    }

    const newRequest = await requestRepository.create({
      requestId: '',
      organizationId: orgId,
      requesterId: user.id,
      requesterName: user.name,
      departmentId: dept.id,
      departmentName: dept.name,
      requestTypeId: reqType?.id,
      requestTypeName: reqType?.name,
      workflowTemplateId: workflowTemplateId || reqType?.defaultWorkflowId || 'wf-it-support',
      currentStepId: 'step-it-2',
      currentStepName: initialStepName,
      title,
      description,
      priority: priority || reqType?.defaultPriority || 'MEDIUM',
      status: initialStatus,
      approvalPolicy: policy,
      dueDate
    });

    // If approval required, create pending approval record
    if (policy === 'EXECUTIVE_ONLY' || policy === 'MULTI_TIER_CHAIN') {
      const adminUser = (await userRepository.findAll(orgId)).find(u => u.role === 'SUPER_ADMIN') || { id: 'user-superadmin', name: 'Office of the Vice-Chancellor / Executive' };
      await requestRepository.addApproval(orgId, newRequest.requestId, {
        requestId: newRequest.requestId,
        stepId: 'approval-exec',
        approverId: adminUser.id,
        approverName: 'Office of the Vice-Chancellor / Executive Authority',
        status: 'PENDING'
      });

      await notificationRepository.create({
        userId: adminUser.id,
        organizationId: orgId,
        title: `Executive Approval Gate: ${newRequest.requestId}`,
        message: `${user.name} submitted request "${newRequest.title}" awaiting executive sign-off.`,
        type: 'APPROVAL',
        link: newRequest.requestId,
        read: false
      });
    } else if (policy === 'DEPT_MANAGER') {
      const mgrId = dept.managerId || 'user-superadmin';
      const mgrName = dept.managerName || `${dept.name} Manager`;
      await requestRepository.addApproval(orgId, newRequest.requestId, {
        requestId: newRequest.requestId,
        stepId: 'approval-manager',
        approverId: mgrId,
        approverName: mgrName,
        status: 'PENDING'
      });
    }

    // Notify Department Manager
    if (dept.managerId) {
      await notificationRepository.create({
        userId: dept.managerId,
        organizationId: orgId,
        title: `New ${dept.code} Request Submitted`,
        message: `${user.name} submitted request ${newRequest.requestId}: "${newRequest.title}".`,
        type: 'REQUEST',
        link: newRequest.requestId,
        read: false
      });
    }

    // Audit log
    await auditRepository.log(
      orgId,
      { id: user.id, name: user.name, role: user.role },
      'REQUEST_CREATED',
      'Request',
      newRequest.requestId,
      { title: newRequest.title, department: dept.name, priority: newRequest.priority, approvalPolicy: policy }
    );

    const freshCreated = await requestRepository.findById(orgId, newRequest.id);
    res.status(201).json({ success: true, data: freshCreated || newRequest });
  } catch (err: any) {
    console.error('Request creation error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message || 'Failed to create request' } });
  }
});

// Update Request Status or Waiting Blocker
router.patch('/:id', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id } = req.params;
  const { status, waitingOn, assigneeId, currentStepName } = req.body;

  const request = await requestRepository.findById(orgId, id);
  if (!request) {
    res.status(404).json({ success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } });
    return;
  }

  if (!canUserAccessRequest(user, request)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied.' } });
    return;
  }

  const updates: any = {};
  if (status) updates.status = status;
  if (waitingOn !== undefined) {
    updates.waitingOn = waitingOn;
    updates.waitingSince = waitingOn ? new Date().toISOString() : undefined;
  }
  if (currentStepName) updates.currentStepName = currentStepName;

  if (assigneeId) {
    const assignee = await userRepository.findById(assigneeId);
    if (assignee) {
      updates.assigneeId = assignee.id;
      updates.assigneeName = assignee.name;
    }
  }

  const updated = await requestRepository.update(orgId, request.id, updates);

  // Add timeline event
  if (status && status !== request.status) {
    await requestRepository.addTimelineEvent(orgId, request.requestId, {
      actorId: user.id,
      actorName: user.name,
      eventType: 'STATUS_CHANGE',
      title: `Status Changed to ${status}`,
      details: waitingOn ? `Waiting on: ${waitingOn}` : undefined
    });

    // Notify requester
    await notificationRepository.create({
      userId: request.requesterId,
      organizationId: orgId,
      title: `Request ${request.requestId} Updated`,
      message: `Your request status changed to ${status}.`,
      type: 'REQUEST',
      link: request.requestId,
      read: false
    });
  }

  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'REQUEST_UPDATED',
    'Request',
    request.requestId,
    updates
  );

  res.json({ success: true, data: updated });
});

// Mark Request as Completed (Verification by Manager)
router.post('/:id/complete', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id } = req.params;

  const request = await requestRepository.findById(orgId, id);
  if (!request) {
    res.status(404).json({ success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } });
    return;
  }

  if (user.role === 'EMPLOYEE') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only managers or administrators can close requests.' } });
    return;
  }

  const now = new Date().toISOString();
  const updated = await requestRepository.update(orgId, request.id, {
    status: 'COMPLETED',
    completedAt: now,
    waitingOn: undefined,
    waitingSince: undefined,
    currentStepName: 'Completed & Verified'
  });

  await requestRepository.addTimelineEvent(orgId, request.requestId, {
    actorId: user.id,
    actorName: user.name,
    eventType: 'STATUS_CHANGE',
    title: 'Request Verified & Completed',
    details: `Closed by ${user.name} after verifying all resolution tasks.`
  });

  // Notify requester
  await notificationRepository.create({
    userId: request.requesterId,
    organizationId: orgId,
    title: 'Request Completed',
    message: `Your request ${request.requestId} ("${request.title}") has been successfully resolved and completed!`,
    type: 'REQUEST',
    link: request.requestId,
    read: false
  });

  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'REQUEST_COMPLETED',
    'Request',
    request.requestId,
    { closedBy: user.name }
  );

  res.json({ success: true, data: updated });
});

// Decide on Approval (Approve or Reject by Executive / Department Manager)
router.post('/:id/approvals/:approvalId', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id, approvalId } = req.params;
  const { decision, notes } = req.body; // 'APPROVED' | 'REJECTED'

  if (!decision || (decision !== 'APPROVED' && decision !== 'REJECTED')) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_DECISION', message: 'Decision must be either APPROVED or REJECTED.' }
    });
    return;
  }

  const request = await requestRepository.findById(orgId, id);
  if (!request) {
    res.status(404).json({ success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } });
    return;
  }

  // RBAC verification: Only Super Admin, Org Admin, or Manager of the department can sign approvals
  const isExecutive = user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';
  const isDeptManager = user.role === 'MANAGER' && user.departmentId === request.departmentId;

  if (!isExecutive && !isDeptManager) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not have administrative authority to sign this approval.' }
    });
    return;
  }

  const updatedApproval = await requestRepository.updateApproval(orgId, request.requestId, approvalId, decision, notes);
  if (!updatedApproval) {
    res.status(404).json({ success: false, error: { code: 'APPROVAL_NOT_FOUND', message: 'Approval record not found.' } });
    return;
  }

  let stepName = request.currentStepName;

  if (decision === 'APPROVED') {
    stepName = `Approved by ${user.name} (${user.role}) — Active for Execution`;

    await requestRepository.update(orgId, request.id, {
      status: 'ACTIVE',
      currentStepName: stepName
    });

    await requestRepository.addTimelineEvent(orgId, request.requestId, {
      actorId: user.id,
      actorName: user.name,
      eventType: 'APPROVAL',
      title: `Approval Granted by ${user.name}`,
      details: notes || `Executive sign-off recorded under ${user.role} authority.`
    });

    // Auto-generate actionable task in department queue for technicians/operators to execute!
    await taskRepository.create({
      requestId: request.requestId,
      requestTitle: request.title,
      organizationId: orgId,
      departmentId: request.departmentId,
      title: `Execute Approved Action: ${request.title}`,
      description: `Action authorized by ${user.name}. Instructions: ${notes || 'Proceed with standard operational execution.'}`,
      taskType: 'Operational Execution',
      assigneeId: user.id,
      assigneeName: `${request.departmentName || 'Department'} Queue`,
      createdById: user.id,
      createdByName: user.name,
      status: 'TODO'
    });

    // Notify Requester
    await notificationRepository.create({
      userId: request.requesterId,
      organizationId: orgId,
      title: 'Approval Granted 🎉',
      message: `Your request ${request.requestId} ("${request.title}") has been approved by ${user.name} and is now active for execution.`,
      type: 'APPROVAL',
      link: request.requestId,
      read: false
    });

    await auditRepository.log(
      orgId,
      { id: user.id, name: user.name, role: user.role },
      'APPROVAL_GRANTED',
      'Request',
      request.requestId,
      { approver: user.name, decision: 'APPROVED', notes }
    );

  } else {
    // REJECTED
    stepName = `Declined by ${user.name}: ${notes || 'Declined'}`;

    await requestRepository.update(orgId, request.id, {
      status: 'REJECTED',
      currentStepName: stepName
    });

    await requestRepository.addTimelineEvent(orgId, request.requestId, {
      actorId: user.id,
      actorName: user.name,
      eventType: 'APPROVAL',
      title: `Request Declined by ${user.name}`,
      details: notes || 'Approval declined by executive authority.'
    });

    await notificationRepository.create({
      userId: request.requesterId,
      organizationId: orgId,
      title: 'Request Declined',
      message: `Your request ${request.requestId} was not approved. Reason: ${notes || 'Declined by executive.'}`,
      type: 'APPROVAL',
      link: request.requestId,
      read: false
    });

    await auditRepository.log(
      orgId,
      { id: user.id, name: user.name, role: user.role },
      'APPROVAL_REJECTED',
      'Request',
      request.requestId,
      { approver: user.name, decision: 'REJECTED', notes }
    );
  }

  const freshRequest = await requestRepository.findById(orgId, request.id);
  res.json({ success: true, data: freshRequest });
});

// Add Comment
router.post('/:id/comments', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Comment content cannot be empty.' } });
    return;
  }

  const request = await requestRepository.findById(orgId, id);
  if (!request) {
    res.status(404).json({ success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } });
    return;
  }

  if (!canUserAccessRequest(user, request)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied.' } });
    return;
  }

  const comment = await requestRepository.addComment(orgId, request.requestId, {
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    content: content.trim()
  });

  res.status(201).json({ success: true, data: comment });
});

// Get Attachments for Request
router.get('/:id/attachments', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id } = req.params;

  const request = await requestRepository.findById(orgId, id);
  if (!request) {
    res.status(404).json({ success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } });
    return;
  }

  if (!canUserAccessRequest(user, request)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied.' } });
    return;
  }

  const attachments = await requestRepository.getAttachments(orgId, request.requestId);
  res.json({ success: true, data: attachments });
});

// Upload / Add Attachment to Request
router.post('/:id/attachments', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const { id } = req.params;
  const { fileName, fileSize, fileType, fileUrl } = req.body;

  if (!fileName || !fileUrl) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'File name and fileUrl are required.' } });
    return;
  }

  const request = await requestRepository.findById(orgId, id);
  if (!request) {
    res.status(404).json({ success: false, error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } });
    return;
  }

  if (!canUserAccessRequest(user, request)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied.' } });
    return;
  }

  const attachment = await requestRepository.addAttachment(orgId, request.requestId, {
    requestId: request.requestId,
    fileName,
    fileSize: Number(fileSize) || 0,
    fileType: fileType || 'application/octet-stream',
    fileUrl,
    uploadedById: user.id,
    uploadedByName: user.name
  });

  // Record timeline event
  await requestRepository.addTimelineEvent(orgId, request.requestId, {
    actorId: user.id,
    actorName: user.name,
    eventType: 'COMMENT',
    title: `Document Attached: ${fileName}`,
    details: `${user.name} attached file "${fileName}" (${Math.round((Number(fileSize) || 0) / 1024)} KB).`
  });

  // Audit log
  await auditRepository.log(
    orgId,
    { id: user.id, name: user.name, role: user.role },
    'ATTACHMENT_ADDED',
    'Request',
    request.requestId,
    { fileName, fileSize, fileType }
  );

  res.status(201).json({ success: true, data: attachment });
});

export default router;
