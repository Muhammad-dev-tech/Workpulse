import { Router, Response } from 'express';
import { requestRepository, departmentRepository, userRepository, auditRepository, notificationRepository, taskRepository, organizationRepository } from '../repositories';
import {
  requireAuthentication,
  AuthenticatedRequest,
  canUserAccessRequest,
  canUserAccessDepartment
} from '../middleware/auth';
import { getTerminology, OrgTerminology } from '../config/terminology';

const router = Router();

const loadTerms = async (orgId: string): Promise<OrgTerminology> => {
  const org = await organizationRepository.findById(orgId);
  return getTerminology(org?.orgType, org?.name);
};

// Pending Radar: Scoped Operational Statistics
router.get('/radar', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.organizationId!;
  const user = req.user!;
  const allRequests = await requestRepository.findAll(orgId);

  // Filter requests based on user role and department scope
  let visibleRequests = allRequests;
  if (user.role === 'MANAGER') {
    visibleRequests = allRequests.filter(
      r => r.departmentId === user.departmentId ||
           r.requesterId === user.id ||
           r.assigneeId === user.id ||
           (r.approvals && r.approvals.some(a => a.approverId === user.id)) ||
           (r.tasks && r.tasks.some(t => t.assigneeId === user.id))
    );
  } else if (user.role === 'EMPLOYEE' || user.role === 'OPERATOR') {
    visibleRequests = allRequests.filter(
      r => r.requesterId === user.id ||
           r.assigneeId === user.id ||
           (r.approvals && r.approvals.some(a => a.approverId === user.id)) ||
           (r.tasks && r.tasks.some(t => t.assigneeId === user.id))
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

    const reqType = (requestTypeId ? dept.requestTypes.find(rt => rt.id === requestTypeId || rt.name.toLowerCase() === requestTypeId.toLowerCase()) : undefined) || dept.requestTypes[0];

    const terms = await loadTerms(orgId);
    const execTitle = terms.roles.SUPER_ADMIN;
    const orgAdminTitle = terms.roles.ORG_ADMIN;
    const deanTitle = terms.roles.DEAN;
    const mgrTitle = terms.roles.MANAGER;
    const requesterRoleTitle = terms.roles[user.role] || user.role;

    // RULE: Executive roles (Platform Super Admin, Org Super Admin / VC / CEO, and Dean)
    // bypass all department pre-approval bottlenecks and route DIRECTLY to the destination department/faculty.
    const isExemptExecutive = user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN' || user.role === 'DEAN';

    // Department policy
    const deptPolicy = dept.approvalPolicy || (dept.requiresApproval ? 'DEPT_MANAGER' : 'DIRECT');
    let policy: 'DIRECT' | 'DEPT_MANAGER' | 'DEAN' | 'EXECUTIVE_ONLY' | 'MULTI_TIER_CHAIN';

    if (isExemptExecutive) {
      // Executive request goes direct even if the department normally requires pre-approval
      policy = 'DIRECT';
    } else if (approvalPolicy && ['DIRECT', 'DEPT_MANAGER', 'DEAN', 'EXECUTIVE_ONLY', 'MULTI_TIER_CHAIN'].includes(approvalPolicy)) {
      policy = approvalPolicy as any;
    } else if (deptPolicy && ['DIRECT', 'DEPT_MANAGER', 'DEAN', 'EXECUTIVE_ONLY', 'MULTI_TIER_CHAIN'].includes(deptPolicy as any)) {
      policy = deptPolicy as any;
    } else if (reqType?.approvalPolicy && ['DIRECT', 'DEPT_MANAGER', 'DEAN', 'EXECUTIVE_ONLY', 'MULTI_TIER_CHAIN'].includes(reqType.approvalPolicy)) {
      policy = reqType.approvalPolicy as any;
    } else if (dept.requiresApproval) {
      policy = 'DEPT_MANAGER';
    } else {
      policy = 'DIRECT';
    }

    const allOrgUsers = await userRepository.findAll(orgId);
    const targetDeptManager =
      (dept.managerId ? allOrgUsers.find(u => u.id === dept.managerId) : undefined) ||
      allOrgUsers.find(u => u.role === 'MANAGER' && u.departmentId === dept.id);

    let initialStatus: 'SUBMITTED' | 'ACTIVE' | 'PENDING_APPROVAL' = 'ACTIVE';
    let initialStepName = isExemptExecutive
      ? `Executive Direct Dispatch to ${dept.name}`
      : `Dispatched to ${dept.name} queue`;

    if (policy === 'MULTI_TIER_CHAIN') {
      initialStatus = 'PENDING_APPROVAL';
      initialStepName = `Awaiting ${mgrTitle} approval (step 1 of 3)`;
    } else if (policy === 'EXECUTIVE_ONLY') {
      initialStatus = 'PENDING_APPROVAL';
      initialStepName = `Awaiting ${execTitle} approval`;
    } else if (policy === 'DEAN') {
      initialStatus = 'PENDING_APPROVAL';
      initialStepName = `Awaiting ${deanTitle} approval`;
    } else if (policy === 'DEPT_MANAGER') {
      initialStatus = 'PENDING_APPROVAL';
      initialStepName = `Awaiting ${mgrTitle} approval before dispatch to ${dept.name}`;
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
      workflowTemplateId: workflowTemplateId || reqType?.defaultWorkflowId || undefined,
      currentStepId: undefined,
      currentStepName: initialStepName,
      title,
      description,
      priority: priority || reqType?.defaultPriority || 'MEDIUM',
      status: initialStatus,
      approvalPolicy: policy,
      assigneeId: policy === 'DIRECT' ? targetDeptManager?.id : undefined,
      assigneeName: (policy === 'DIRECT' && targetDeptManager) ? `${targetDeptManager.name} (${mgrTitle})` : undefined,
      dueDate
    });

    if (policy === 'DIRECT') {
      // Direct policy routes straight to the operational department queue
      const timelineTitle = isExemptExecutive
        ? `Executive Direct Dispatch to ${dept.name}`
        : `Dispatched Directly to ${dept.name}`;
      const timelineDetails = isExemptExecutive
        ? `Dispatched directly by ${user.name} (${requesterRoleTitle}). Pre-approval requirements bypassed; routed immediately into ${dept.name} (${terms.unit}) execution queue.`
        : `Routed directly to ${dept.name} (${terms.unit}) queue for operational execution without approval bottlenecks.`;

      await requestRepository.addTimelineEvent(orgId, newRequest.requestId, {
        actorId: user.id,
        actorName: user.name,
        eventType: 'STATUS_CHANGE',
        title: timelineTitle,
        details: timelineDetails
      });

      if (targetDeptManager) {
        // Auto-create initial operational execution task for the target department manager
        await taskRepository.create({
          requestId: newRequest.requestId,
          requestTitle: newRequest.title,
          organizationId: orgId,
          departmentId: dept.id,
          title: `Direct Execution: ${newRequest.title}`,
          description: `Direct operational requisition received from ${user.name} (Requester). Priority: ${newRequest.priority}. Details: ${newRequest.description}`,
          taskType: 'Operational Execution',
          assigneeId: targetDeptManager.id,
          assigneeName: targetDeptManager.name,
          createdById: user.id,
          createdByName: user.name,
          status: 'TODO'
        });

        await notificationRepository.create({
          userId: targetDeptManager.id,
          organizationId: orgId,
          title: `New Direct Request in ${dept.name}: ${newRequest.requestId}`,
          message: `${user.name} submitted "${newRequest.title}" directly to your ${terms.unit.toLowerCase()} queue for immediate execution.`,
          type: 'REQUEST',
          link: newRequest.requestId,
          read: false
        });
      }

      await notificationRepository.create({
        userId: user.id,
        organizationId: orgId,
        title: `Request Dispatched: ${newRequest.requestId}`,
        message: `Your request "${newRequest.title}" has been routed directly to ${dept.name} and is now active for execution.`,
        type: 'REQUEST',
        link: newRequest.requestId,
        read: false
      });
    } else if (policy === 'MULTI_TIER_CHAIN') {
      const deptMgr = targetDeptManager ||
                      allOrgUsers.find(u => u.role === 'MANAGER') ||
                      allOrgUsers.find(u => u.role === 'SUPER_ADMIN') ||
                      user;
      const mgrId = deptMgr.id;
      const mgrName = deptMgr.name;

      await requestRepository.addApproval(orgId, newRequest.requestId, {
        requestId: newRequest.requestId,
        stepId: 'tier-1-dept-manager',
        approverId: mgrId,
        approverName: `${mgrName} (${mgrTitle})`,
        status: 'PENDING'
      });

      await requestRepository.update(orgId, newRequest.id, {
        currentStepName: `Awaiting ${mgrTitle} approval (step 1 of 3)`
      });

      await requestRepository.addTimelineEvent(orgId, newRequest.requestId, {
        actorId: user.id,
        actorName: user.name,
        eventType: 'STATUS_CHANGE',
        title: `Submitted for Multi-Tier Approval`,
        details: `Tier 1 review initiated by ${mgrName} (${mgrTitle}).`
      });

      if (mgrId) {
        await notificationRepository.create({
          userId: mgrId,
          organizationId: orgId,
          title: `Approval required: ${newRequest.requestId}`,
          message: `${user.name} submitted request "${newRequest.title}" awaiting your review before escalating.`,
          type: 'APPROVAL',
          link: newRequest.requestId,
          read: false
        });
      }
    } else if (policy === 'EXECUTIVE_ONLY') {
      const adminUser = allOrgUsers.find(u => u.role === 'SUPER_ADMIN') ||
                        allOrgUsers.find(u => u.role === 'ORG_ADMIN') ||
                        user;

      await requestRepository.addApproval(orgId, newRequest.requestId, {
        requestId: newRequest.requestId,
        stepId: 'approval-exec',
        approverId: adminUser.id,
        approverName: `${adminUser.name} (${execTitle})`,
        status: 'PENDING'
      });

      await requestRepository.update(orgId, newRequest.id, {
        currentStepName: `Awaiting ${execTitle} approval`
      });

      await requestRepository.addTimelineEvent(orgId, newRequest.requestId, {
        actorId: user.id,
        actorName: user.name,
        eventType: 'STATUS_CHANGE',
        title: `Submitted for Executive Approval`,
        details: `Executive authorization required by ${adminUser.name} (${execTitle}).`
      });

      await notificationRepository.create({
        userId: adminUser.id,
        organizationId: orgId,
        title: `Approval required: ${newRequest.requestId}`,
        message: `${user.name} submitted "${newRequest.title}" for your executive approval.`,
        type: 'APPROVAL',
        link: newRequest.requestId,
        read: false
      });
    } else if (policy === 'DEAN') {
      const deanUser =
        (dept.faculty ? allOrgUsers.find(u => u.role === 'DEAN' && u.faculty?.toLowerCase() === dept.faculty?.toLowerCase()) : undefined) ||
        allOrgUsers.find(u => u.role === 'DEAN') ||
        allOrgUsers.find(u => u.role === 'SUPER_ADMIN') ||
        allOrgUsers.find(u => u.role === 'ORG_ADMIN') ||
        user;

      const deanId = deanUser.id;
      const deanName = deanUser.name;

      await requestRepository.addApproval(orgId, newRequest.requestId, {
        requestId: newRequest.requestId,
        stepId: 'approval-dean',
        approverId: deanId,
        approverName: `${deanName} (${deanTitle}${dept.faculty ? ` - ${dept.faculty}` : ''})`,
        status: 'PENDING'
      });

      await requestRepository.update(orgId, newRequest.id, {
        currentStepName: `Awaiting ${deanTitle} approval`
      });

      await requestRepository.addTimelineEvent(orgId, newRequest.requestId, {
        actorId: user.id,
        actorName: user.name,
        eventType: 'STATUS_CHANGE',
        title: `Submitted for ${deanTitle} Approval`,
        details: `Requisition awaiting review & authorization by ${deanName} (${deanTitle}${dept.faculty ? ` - ${dept.faculty}` : ''}).`
      });

      if (deanId) {
        await notificationRepository.create({
          userId: deanId,
          organizationId: orgId,
          title: `Approval required: ${newRequest.requestId}`,
          message: `${user.name} submitted request "${newRequest.title}" for ${dept.name} awaiting your approval.`,
          type: 'APPROVAL',
          link: newRequest.requestId,
          read: false
        });
      }
    } else if (policy === 'DEPT_MANAGER') {
      const deptMgr = targetDeptManager ||
                      allOrgUsers.find(u => u.role === 'MANAGER') ||
                      allOrgUsers.find(u => u.role === 'SUPER_ADMIN') ||
                      user;
      const mgrId = deptMgr.id;
      const mgrName = deptMgr.name;

      await requestRepository.addApproval(orgId, newRequest.requestId, {
        requestId: newRequest.requestId,
        stepId: 'approval-manager',
        approverId: mgrId,
        approverName: `${mgrName} (${mgrTitle})`,
        status: 'PENDING'
      });

      await requestRepository.update(orgId, newRequest.id, {
        currentStepName: `Awaiting ${mgrTitle} approval`
      });

      await requestRepository.addTimelineEvent(orgId, newRequest.requestId, {
        actorId: user.id,
        actorName: user.name,
        eventType: 'STATUS_CHANGE',
        title: `Submitted for ${mgrTitle} Approval`,
        details: `Requisition awaiting authorization by ${mgrName} (${mgrTitle}).`
      });

      if (mgrId) {
        await notificationRepository.create({
          userId: mgrId,
          organizationId: orgId,
          title: `Approval required: ${newRequest.requestId}`,
          message: `${user.name} submitted request "${newRequest.title}" awaiting your authorization.`,
          type: 'APPROVAL',
          link: newRequest.requestId,
          read: false
        });
      }
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

  // RBAC verification: Verify authority for the specific approval step
  const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';
  const isDean = user.role === 'DEAN';
  const isDeptManager = user.role === 'MANAGER' && (!user.departmentId || user.departmentId === request.departmentId);

  const currentApproval = request.approvals?.find(a => a.id === approvalId);
  const stepId = currentApproval?.stepId || '';

  let isAuthorized = false;
  if (isSuperAdmin) {
    isAuthorized = true; // Top executive has ultimate authority and signs the final step
  } else if (currentApproval?.approverId === user.id) {
    isAuthorized = true; // Explicitly assigned approver
  } else if (isDean && (stepId === 'tier-2-dean' || stepId === 'approval-dean' || request.approvalPolicy === 'DEAN' || request.approvalPolicy === 'EXECUTIVE_ONLY')) {
    isAuthorized = true;
  } else if (isDeptManager && (stepId === 'tier-1-dept-manager' || stepId === 'approval-manager' || request.approvalPolicy === 'DEPT_MANAGER')) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not have administrative authority to sign this approval tier.' }
    });
    return;
  }

  const updatedApproval = await requestRepository.updateApproval(orgId, request.requestId, approvalId, decision, notes);
  if (!updatedApproval) {
    res.status(404).json({ success: false, error: { code: 'APPROVAL_NOT_FOUND', message: 'Approval record not found.' } });
    return;
  }

  const terms = await loadTerms(orgId);
  const actorTitle = terms.roles[user.role] || user.role;

  if (decision === 'REJECTED') {
    const stepName = `Rejected by ${user.name} (${actorTitle})`;
    await requestRepository.update(orgId, request.id, {
      status: 'REJECTED',
      currentStepName: stepName
    });

    await requestRepository.addTimelineEvent(orgId, request.requestId, {
      actorId: user.id,
      actorName: user.name,
      eventType: 'APPROVAL',
      title: `Request rejected by ${user.name}`,
      details: notes || `Rejected by the ${actorTitle}.`
    });

    await notificationRepository.create({
      userId: request.requesterId,
      organizationId: orgId,
      title: 'Request Rejected',
      message: `Your request "${request.title}" was rejected by ${user.name}. Reason: ${notes || 'No notes provided.'}`,
      type: 'APPROVAL',
      link: request.requestId,
      read: false
    });

    const updated = await requestRepository.findById(orgId, id);
    res.json({ success: true, data: updated });
    return;
  }

  // Handle APPROVED decision
  if (decision === 'APPROVED') {
    const isMultiTierChain = request.approvalPolicy === 'MULTI_TIER_CHAIN' ||
      stepId.startsWith('tier-') ||
      (request.currentStepName && request.currentStepName.includes('Tier '));

    if (isMultiTierChain) {
      const allUsers = await userRepository.findAll(orgId);
      const { MANAGER: mgrTitle, DEAN: deanTitle, SUPER_ADMIN: execTitle } = terms.roles;

      if (stepId === 'tier-1-dept-manager') {
        const deanUser = allUsers.find(u => u.role === 'DEAN');

        if (deanUser) {
          // Advance to step 2: Dean-level approver
          await requestRepository.addApproval(orgId, request.requestId, {
            requestId: request.requestId,
            stepId: 'tier-2-dean',
            approverId: deanUser.id,
            approverName: `${deanUser.name} (${deanTitle})`,
            status: 'PENDING'
          });

          await requestRepository.update(orgId, request.id, {
            currentStepName: `Awaiting ${deanTitle} approval (step 2 of 3)`
          });

          await requestRepository.addTimelineEvent(orgId, request.requestId, {
            actorId: user.id,
            actorName: user.name,
            eventType: 'APPROVAL',
            title: `Approved by ${user.name} (${mgrTitle})`,
            details: notes ? `${notes}. Forwarded to ${deanUser.name} (${deanTitle}).` : `Forwarded to ${deanUser.name} (${deanTitle}).`
          });

          await notificationRepository.create({
            userId: deanUser.id,
            organizationId: orgId,
            title: `Approval required: ${request.requestId}`,
            message: `${user.name} (${mgrTitle}) approved "${request.title}". It now needs your approval.`,
            type: 'APPROVAL',
            link: request.requestId,
            read: false
          });

          const updated = await requestRepository.findById(orgId, id);
          res.json({ success: true, data: updated });
          return;
        } else {
          // No dean-level approver configured, go straight to the top executive
          const adminUser = allUsers.find(u => u.role === 'SUPER_ADMIN') ||
                            allUsers.find(u => u.role === 'ORG_ADMIN') ||
                            user;

          await requestRepository.addApproval(orgId, request.requestId, {
            requestId: request.requestId,
            stepId: 'tier-3-super-admin',
            approverId: adminUser.id,
            approverName: `${adminUser.name} (${execTitle})`,
            status: 'PENDING'
          });

          await requestRepository.update(orgId, request.id, {
            currentStepName: `Awaiting ${execTitle} approval (step 2 of 2)`
          });

          await requestRepository.addTimelineEvent(orgId, request.requestId, {
            actorId: user.id,
            actorName: user.name,
            eventType: 'APPROVAL',
            title: `Approved by ${user.name} (${mgrTitle})`,
            details: notes ? `${notes}. Forwarded to the ${execTitle}.` : `Forwarded to the ${execTitle}.`
          });

          if (adminUser.id) {
            await notificationRepository.create({
              userId: adminUser.id,
              organizationId: orgId,
              title: `Final approval required: ${request.requestId}`,
              message: `${user.name} (${mgrTitle}) approved "${request.title}". It now needs your final approval.`,
              type: 'APPROVAL',
              link: request.requestId,
              read: false
            });
          }

          const updated = await requestRepository.findById(orgId, id);
          res.json({ success: true, data: updated });
          return;
        }
      } else if (stepId === 'tier-2-dean') {
        // Step 2 approved, advance to final step: top executive
        const adminUser = allUsers.find(u => u.role === 'SUPER_ADMIN') ||
                          allUsers.find(u => u.role === 'ORG_ADMIN') ||
                          user;

        await requestRepository.addApproval(orgId, request.requestId, {
          requestId: request.requestId,
          stepId: 'tier-3-super-admin',
          approverId: adminUser.id,
          approverName: `${adminUser.name} (${execTitle})`,
          status: 'PENDING'
        });

        await requestRepository.update(orgId, request.id, {
          currentStepName: `Awaiting ${execTitle} approval (step 3 of 3)`
        });

        await requestRepository.addTimelineEvent(orgId, request.requestId, {
          actorId: user.id,
          actorName: user.name,
          eventType: 'APPROVAL',
          title: `Approved by ${user.name} (${deanTitle})`,
          details: notes ? `${notes}. Forwarded to ${adminUser.name} (${execTitle}).` : `Forwarded to ${adminUser.name} (${execTitle}).`
        });

        if (adminUser.id) {
          await notificationRepository.create({
            userId: adminUser.id,
            organizationId: orgId,
            title: `Final approval required: ${request.requestId}`,
            message: `${user.name} (${deanTitle}) approved "${request.title}". It now needs your final approval.`,
            type: 'APPROVAL',
            link: request.requestId,
            read: false
          });
        }

        const updated = await requestRepository.findById(orgId, id);
        res.json({ success: true, data: updated });
        return;
      }
      // If tier-3-super-admin was approved, fall through to complete approval & activate!
    }

    // Final Approval Reached! Route the request to the target department for execution
    const deptUnitLabel = request.departmentName || terms.unit;
    const stepName = `Approved — sent to ${deptUnitLabel} queue`;

    // Resolve the Head of the target department (NOT the approver)
    const targetDept = await departmentRepository.findById(orgId, request.departmentId);
    const orgUsers = await userRepository.findAll(orgId);
    const hod =
      (targetDept?.managerId ? orgUsers.find(u => u.id === targetDept.managerId) : undefined) ||
      orgUsers.find(u => u.role === 'MANAGER' && u.departmentId === request.departmentId);

    await requestRepository.update(orgId, request.id, {
      status: 'ACTIVE',
      currentStepName: stepName,
      assigneeId: hod?.id,
      assigneeName: hod ? `${hod.name} (${terms.roles.MANAGER})` : undefined
    });

    await requestRepository.addTimelineEvent(orgId, request.requestId, {
      actorId: user.id,
      actorName: user.name,
      eventType: 'APPROVAL',
      title: `Final approval granted by ${user.name}`,
      details: `${notes ? notes + '. ' : ''}Forwarded to ${deptUnitLabel}${hod ? ` (${hod.name}, ${terms.roles.MANAGER})` : ''} for execution.`
    });

    // Auto-generate the execution task in the target department's queue, owned by its HOD
    if (hod) {
      await taskRepository.create({
        requestId: request.requestId,
        requestTitle: request.title,
        organizationId: orgId,
        departmentId: request.departmentId,
        title: `Execute Approved Action: ${request.title}`,
        description: `Authorized by ${user.name} (${actorTitle}). Instructions: ${notes || 'Proceed with standard operational execution.'}`,
        taskType: 'Operational Execution',
        assigneeId: hod.id,
        assigneeName: hod.name,
        createdById: user.id,
        createdByName: user.name,
        status: 'TODO'
      });

      await notificationRepository.create({
        userId: hod.id,
        organizationId: orgId,
        title: `Approved request routed to your ${terms.unit.toLowerCase()}: ${request.requestId}`,
        message: `"${request.title}" received final approval from ${user.name} (${actorTitle}) and is now in the ${deptUnitLabel} queue for execution.`,
        type: 'REQUEST',
        link: request.requestId,
        read: false
      });
    }

    // Notify Requester
    await notificationRepository.create({
      userId: request.requesterId,
      organizationId: orgId,
      title: 'Approval Granted 🎉',
      message: `Your request "${request.title}" has been authorized by ${user.name} and is now active for execution.`,
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
