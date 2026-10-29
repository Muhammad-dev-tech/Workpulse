import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Organization,
  Department,
  DepartmentRequestType,
  User,
  WorkflowTemplate,
  WorkflowStep,
  RequestItem,
  NotificationItem,
  TaskItem,
  AuditLog,
  TimelineEvent,
  Comment,
  Approval,
  AttachmentItem
} from '../types';
import {
  IOrganizationRepository,
  IRequestRepository,
  ITaskRepository,
  IWorkflowRepository,
  IDepartmentRepository,
  IUserRepository,
  INotificationRepository,
  IAuditRepository
} from './interfaces';
import { inferOrgTypeFromName } from '../config/terminology';

// ────────────────────────────────────────────────────
//  Supabase client (singleton)
// ────────────────────────────────────────────────────
let _client: SupabaseClient | null = null;
const inMemoryAttachments = new Map<string, AttachmentItem[]>();

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// ────────────────────────────────────────────────────
//  Camel ↔ Snake case helpers
// ────────────────────────────────────────────────────
function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function mapRow<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) {
    out[toCamel(k)] = row[k];
  }
  return out as T;
}

function mapRows<T>(rows: Record<string, any>[]): T[] {
  return rows.map(r => mapRow<T>(r));
}

// ────────────────────────────────────────────────────
//  Department assembler (joins request_types)
// ────────────────────────────────────────────────────
async function assembleDepartment(
  db: SupabaseClient,
  deptRow: Record<string, any>
): Promise<Department> {
  const { data: rtRows } = await db
    .from('department_request_types')
    .select('*')
    .eq('department_id', deptRow.id);

  const requestTypes: DepartmentRequestType[] = (rtRows || []).map(r => {
    let approvalPolicy = r.approval_policy || undefined;
    let requiresApproval = r.requires_approval || false;
    let slaHours = r.sla_hours || 48;
    let description = r.description || '';

    if (r.description && (r.description.startsWith('{') || r.description.startsWith('__WP_META__:'))) {
      try {
        const raw = r.description.startsWith('__WP_META__:')
          ? r.description.substring('__WP_META__:'.length)
          : r.description;
        const meta = JSON.parse(raw);
        if (meta.approvalPolicy) approvalPolicy = meta.approvalPolicy;
        if (meta.requiresApproval !== undefined) requiresApproval = meta.requiresApproval;
        if (meta.slaHours !== undefined) slaHours = meta.slaHours;
        description = meta.text || '';
      } catch {}
    }

    return {
      id: r.id,
      name: r.name,
      description,
      defaultPriority: r.default_priority,
      defaultWorkflowId: r.default_workflow_id,
      approvalPolicy,
      requiresApproval,
      slaHours
    };
  });

  let faculty = deptRow.faculty;
  let approvalPolicy = deptRow.approval_policy || 'DIRECT';
  let description = deptRow.description || '';

  if (description && (description.startsWith('{') || description.startsWith('__WP_META__:'))) {
    try {
      const raw = description.startsWith('__WP_META__:')
        ? description.substring('__WP_META__:'.length)
        : description;
      const meta = JSON.parse(raw);
      if (meta.faculty) faculty = meta.faculty;
      if (meta.approvalPolicy) approvalPolicy = meta.approvalPolicy;
      description = meta.text !== undefined ? meta.text : description;
    } catch {}
  }

  return {
    id: deptRow.id,
    organizationId: deptRow.organization_id,
    name: deptRow.name,
    code: deptRow.code,
    description,
    faculty,
    approvalPolicy,
    requiresApproval: approvalPolicy !== 'DIRECT',
    managerId: deptRow.manager_id,
    managerName: deptRow.manager_name,
    responsibilities: deptRow.responsibilities || [],
    taskTypes: deptRow.task_types || [],
    employeeIds: deptRow.employee_ids || [],
    requestTypes,
    createdAt: deptRow.created_at
  };
}

// ────────────────────────────────────────────────────
//  Request assembler (joins timeline, comments, approvals, tasks)
// ────────────────────────────────────────────────────
async function assembleRequest(
  db: SupabaseClient,
  reqRow: Record<string, any>
): Promise<RequestItem> {
  const reqId = reqRow.request_id;

  const [{ data: tlRows }, { data: cmtRows }, { data: apprRows }, { data: taskRows }, { data: attRows }] =
    await Promise.all([
      db.from('timeline_events').select('*').eq('request_id', reqId).order('timestamp', { ascending: true }),
      db.from('comments').select('*').eq('request_id', reqId).order('created_at', { ascending: true }),
      db.from('approvals').select('*').eq('request_id', reqId),
      db.from('tasks').select('*').eq('request_id', reqId).order('created_at', { ascending: false }),
      db.from('attachments').select('*').eq('request_id', reqId).order('created_at', { ascending: true })
    ]);

  const timeline: TimelineEvent[] = (tlRows || []).map(r => ({
    id: r.id,
    requestId: r.request_id,
    actorId: r.actor_id,
    actorName: r.actor_name,
    eventType: r.event_type,
    title: r.title,
    details: r.details,
    timestamp: r.timestamp
  }));

  const comments: Comment[] = (cmtRows || []).map(r => ({
    id: r.id,
    requestId: r.request_id,
    authorId: r.author_id,
    authorName: r.author_name,
    authorRole: r.author_role,
    content: r.content,
    createdAt: r.created_at
  }));

  const approvals: Approval[] = (apprRows || []).map(r => ({
    id: r.id,
    requestId: r.request_id,
    stepId: r.step_id,
    approverId: r.approver_id,
    approverName: r.approver_name,
    status: r.status,
    notes: r.notes,
    decidedAt: r.decided_at,
    createdAt: r.created_at
  }));

  const tasks: TaskItem[] = (taskRows || []).map(r => mapRow<TaskItem>(r));

  let attachments: AttachmentItem[] = (attRows || []).map(r => ({
    id: r.id,
    requestId: r.request_id,
    fileName: r.file_name,
    fileSize: r.file_size || 0,
    fileType: r.file_type || 'application/octet-stream',
    fileUrl: r.file_url || '',
    uploadedById: r.uploaded_by_id,
    uploadedByName: r.uploaded_by_name,
    createdAt: r.created_at
  }));

  if (attachments.length === 0 && inMemoryAttachments.has(reqId)) {
    attachments = inMemoryAttachments.get(reqId) || [];
  }

  return {
    id: reqRow.id,
    requestId: reqRow.request_id,
    organizationId: reqRow.organization_id,
    requesterId: reqRow.requester_id,
    requesterName: reqRow.requester_name,
    departmentId: reqRow.department_id,
    departmentName: reqRow.department_name,
    requestTypeId: reqRow.request_type_id,
    requestTypeName: reqRow.request_type_name,
    currentStepId: reqRow.current_step_id,
    currentStepName: reqRow.current_step_name,
    workflowTemplateId: reqRow.workflow_template_id,
    assigneeId: reqRow.assignee_id,
    assigneeName: reqRow.assignee_name,
    title: reqRow.title,
    description: reqRow.description,
    priority: reqRow.priority,
    status: reqRow.status,
    approvalPolicy: (
      reqRow.approval_policy === 'MULTI_TIER_CHAIN' ||
      approvals.some(a => a.stepId?.startsWith('tier-')) ||
      (reqRow.current_step_name && /step \d of \d|tier/i.test(reqRow.current_step_name))
    ) ? 'MULTI_TIER_CHAIN' : (
      reqRow.approval_policy === 'EXECUTIVE_ONLY' ||
      approvals.some(a => a.stepId === 'approval-exec')
    ) ? 'EXECUTIVE_ONLY' : (
      reqRow.approval_policy === 'DEAN' ||
      approvals.some(a => a.stepId === 'approval-dean')
    ) ? 'DEAN' : (
      reqRow.approval_policy === 'DEPT_MANAGER' ||
      approvals.some(a => a.stepId === 'approval-manager')
    ) ? 'DEPT_MANAGER' : (reqRow.approval_policy || 'DIRECT'),
    waitingSince: reqRow.waiting_since,
    dueDate: reqRow.due_date,
    completedAt: reqRow.completed_at,
    createdAt: reqRow.created_at,
    updatedAt: reqRow.updated_at,
    timeline,
    comments,
    approvals,
    tasks,
    attachments
  };
}

// ────────────────────────────────────────────────────
//  WorkflowTemplate assembler (joins steps)
// ────────────────────────────────────────────────────
async function assembleWorkflow(
  db: SupabaseClient,
  wfRow: Record<string, any>
): Promise<WorkflowTemplate> {
  const { data: stepRows } = await db
    .from('workflow_steps')
    .select('*')
    .eq('template_id', wfRow.id)
    .order('step_order', { ascending: true });

  const steps: WorkflowStep[] = (stepRows || []).map(r => ({
    id: r.id,
    templateId: r.template_id,
    stepOrder: r.step_order,
    name: r.name,
    description: r.description,
    departmentId: r.department_id,
    requiredRole: r.required_role,
    requiresApproval: r.requires_approval,
    slaHours: r.sla_hours
  }));

  return {
    id: wfRow.id,
    organizationId: wfRow.organization_id,
    name: wfRow.name,
    description: wfRow.description,
    departmentId: wfRow.department_id,
    steps,
    createdAt: wfRow.created_at
  };
}

// ────────────────────────────────────────────────────
//  REQUEST REPOSITORY
// ────────────────────────────────────────────────────
export class SupabaseRequestRepository implements IRequestRepository {
  private db = getSupabaseClient();

  async findById(organizationId: string, id: string): Promise<RequestItem | null> {
    const { data, error } = await this.db
      .from('requests')
      .select('*')
      .eq('organization_id', organizationId)
      .or(`id.eq.${id},request_id.eq.${id}`)
      .single();
    if (error || !data) return null;
    return assembleRequest(this.db, data);
  }

  async findByRequestId(organizationId: string, requestId: string): Promise<RequestItem | null> {
    const { data, error } = await this.db
      .from('requests')
      .select('*')
      .eq('organization_id', organizationId)
      .ilike('request_id', requestId)
      .single();
    if (error || !data) return null;
    return assembleRequest(this.db, data);
  }

  async findAll(organizationId: string, filters?: {
    status?: string;
    departmentId?: string;
    assigneeId?: string;
    requesterId?: string;
    priority?: string;
    isOverdue?: boolean;
    isWaiting?: boolean;
  }): Promise<RequestItem[]> {
    let q = this.db.from('requests').select('*');
    if (organizationId && organizationId !== 'ALL') {
      q = q.eq('organization_id', organizationId);
    }

    if (filters?.status)      q = q.eq('status', filters.status);
    if (filters?.departmentId) q = q.eq('department_id', filters.departmentId);
    if (filters?.assigneeId)  q = q.eq('assignee_id', filters.assigneeId);
    if (filters?.requesterId) q = q.eq('requester_id', filters.requesterId);
    if (filters?.priority)    q = q.eq('priority', filters.priority);
    if (filters?.isWaiting)   q = q.eq('status', 'WAITING');
    if (filters?.isOverdue)   q = q.lt('due_date', new Date().toISOString()).neq('status', 'COMPLETED');

    q = q.order('created_at', { ascending: false });

    const { data, error } = await q;
    if (error || !data) return [];

    // Assemble all in parallel (limit concurrency to 5 at a time for large datasets)
    const results: RequestItem[] = [];
    for (let i = 0; i < data.length; i += 5) {
      const chunk = data.slice(i, i + 5);
      const assembled = await Promise.all(chunk.map(r => assembleRequest(this.db, r)));
      results.push(...assembled);
    }
    return results;
  }

  async create(data: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt' | 'timeline' | 'comments' | 'approvals' | 'tasks'>): Promise<RequestItem> {
    // Get next sequence value for REQ-XXXX
    const { data: seqRow } = await this.db.rpc('nextval', { seq: 'request_seq' }).single() as any;
    const seq = seqRow ?? Date.now();
    const reqId = `REQ-${seq}`;
    const now = new Date().toISOString();

    let validWorkflowTemplateId: string | null = null;
    if (data.workflowTemplateId) {
      const { data: wfRow } = await this.db
        .from('workflow_templates')
        .select('id')
        .eq('id', data.workflowTemplateId)
        .maybeSingle();
      if (wfRow) {
        validWorkflowTemplateId = wfRow.id;
      }
    }

    const insertPayload: Record<string, any> = {
      request_id: reqId,
      organization_id: data.organizationId,
      requester_id: data.requesterId,
      requester_name: data.requesterName,
      department_id: data.departmentId,
      department_name: data.departmentName,
      request_type_id: data.requestTypeId,
      request_type_name: data.requestTypeName,
      current_step_id: data.currentStepId,
      current_step_name: data.currentStepName,
      workflow_template_id: validWorkflowTemplateId,
      assignee_id: data.assigneeId,
      assignee_name: data.assigneeName,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status || 'SUBMITTED',
      due_date: data.dueDate,
    };

    let { data: row, error } = await this.db
      .from('requests')
      .insert({
        ...insertPayload,
        approval_policy: data.approvalPolicy || 'DIRECT'
      })
      .select()
      .single();

    if (error && error.message.includes('approval_policy')) {
      const retry = await this.db
        .from('requests')
        .insert(insertPayload)
        .select()
        .single();
      row = retry.data;
      error = retry.error;
    }

    if (error && /workflow_template_id/i.test(error.message)) {
      const retryPayload = { ...insertPayload, workflow_template_id: null };
      const retry = await this.db
        .from('requests')
        .insert(retryPayload)
        .select()
        .single();
      row = retry.data;
      error = retry.error;
    }

    if (error || !row) throw new Error(error?.message || 'Failed to create request');

    // Insert initial timeline event
    await this.db.from('timeline_events').insert({
      request_id: reqId,
      actor_id: data.requesterId,
      actor_name: data.requesterName,
      event_type: 'CREATED',
      title: 'Request Created',
      details: `Request initiated: ${data.title}`
    });

    return assembleRequest(this.db, row);
  }

  async update(organizationId: string, id: string, updates: Partial<RequestItem>): Promise<RequestItem | null> {
    const colMap: Record<string, string> = {
      status: 'status',
      priority: 'priority',
      assigneeId: 'assignee_id',
      assigneeName: 'assignee_name',
      currentStepId: 'current_step_id',
      currentStepName: 'current_step_name',
      waitingOn: 'waiting_on',
      waitingSince: 'waiting_since',
      dueDate: 'due_date',
      completedAt: 'completed_at',
      title: 'title',
      description: 'description',
    };

    const patch: Record<string, any> = {};
    for (const [camel, snake] of Object.entries(colMap)) {
      if ((updates as any)[camel] !== undefined) {
        patch[snake] = (updates as any)[camel];
      }
    }

    if (Object.keys(patch).length === 0) {
      return this.findById(organizationId, id);
    }

    const { data, error } = await this.db
      .from('requests')
      .update(patch)
      .eq('organization_id', organizationId)
      .or(`id.eq.${id},request_id.eq.${id}`)
      .select()
      .single();

    if (error || !data) return null;
    return assembleRequest(this.db, data);
  }

  async addTimelineEvent(organizationId: string, requestId: string, event: Omit<TimelineEvent, 'id' | 'timestamp' | 'requestId'>): Promise<TimelineEvent> {
    const req = await this.findById(organizationId, requestId);
    if (!req) throw new Error('Request not found');

    const { data, error } = await this.db
      .from('timeline_events')
      .insert({
        request_id: req.requestId,
        actor_id: event.actorId,
        actor_name: event.actorName,
        event_type: event.eventType,
        title: event.title,
        details: event.details
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || 'Failed to add timeline event');

    return {
      id: data.id,
      requestId: data.request_id,
      actorId: data.actor_id,
      actorName: data.actor_name,
      eventType: data.event_type,
      title: data.title,
      details: data.details,
      timestamp: data.timestamp
    };
  }

  async addComment(organizationId: string, requestId: string, comment: Omit<Comment, 'id' | 'createdAt' | 'requestId'>): Promise<Comment> {
    const req = await this.findById(organizationId, requestId);
    if (!req) throw new Error('Request not found');

    const { data, error } = await this.db
      .from('comments')
      .insert({
        request_id: req.requestId,
        author_id: comment.authorId,
        author_name: comment.authorName,
        author_role: comment.authorRole,
        content: comment.content
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || 'Failed to add comment');

    return {
      id: data.id,
      requestId: data.request_id,
      authorId: data.author_id,
      authorName: data.author_name,
      authorRole: data.author_role,
      content: data.content,
      createdAt: data.created_at
    };
  }

  async addApproval(organizationId: string, requestId: string, approval: Omit<Approval, 'id' | 'createdAt'>): Promise<Approval> {
    const req = await this.findById(organizationId, requestId);
    if (!req) throw new Error('Request not found');

    const { data, error } = await this.db
      .from('approvals')
      .insert({
        request_id: req.requestId,
        step_id: approval.stepId,
        approver_id: approval.approverId,
        approver_name: approval.approverName,
        status: approval.status,
        notes: approval.notes,
        decided_at: approval.decidedAt
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || 'Failed to add approval');

    return {
      id: data.id,
      requestId: data.request_id,
      stepId: data.step_id,
      approverId: data.approver_id,
      approverName: data.approver_name,
      status: data.status,
      notes: data.notes,
      decidedAt: data.decided_at,
      createdAt: data.created_at
    };
  }

  async updateApproval(organizationId: string, requestId: string, approvalId: string, status: 'APPROVED' | 'REJECTED', notes?: string): Promise<Approval | null> {
    const { data, error } = await this.db
      .from('approvals')
      .update({ status, notes, decided_at: new Date().toISOString() })
      .eq('id', approvalId)
      .select()
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      requestId: data.request_id,
      stepId: data.step_id,
      approverId: data.approver_id,
      approverName: data.approver_name,
      status: data.status,
      notes: data.notes,
      decidedAt: data.decided_at,
      createdAt: data.created_at
    };
  }

  async addTask(organizationId: string, requestId: string, task: TaskItem): Promise<TaskItem> {
    // Task already inserted via SupabaseTaskRepository.create — just return it
    return task;
  }

  async updateTask(organizationId: string, requestId: string, taskId: string, updates: Partial<TaskItem>): Promise<TaskItem | null> {
    const patch: Record<string, any> = {};
    if (updates.status !== undefined)      patch['status'] = updates.status;
    if (updates.resultNotes !== undefined) patch['result_notes'] = updates.resultNotes;
    if (updates.completedAt !== undefined) patch['completed_at'] = updates.completedAt;

    const { data, error } = await this.db
      .from('tasks')
      .update(patch)
      .or(`id.eq.${taskId},task_id.eq.${taskId}`)
      .select()
      .single();

    if (error || !data) return null;
    return mapRow<TaskItem>(data);
  }

  async addAttachment(organizationId: string, requestId: string, attachment: Omit<AttachmentItem, 'id' | 'createdAt'>): Promise<AttachmentItem> {
    const { data, error } = await this.db
      .from('attachments')
      .insert({
        request_id: requestId,
        file_name: attachment.fileName,
        file_size: attachment.fileSize,
        file_type: attachment.fileType,
        file_url: attachment.fileUrl,
        uploaded_by_id: attachment.uploadedById,
        uploaded_by_name: attachment.uploadedByName
      })
      .select()
      .single();

    if (error || !data) {
      const fallback: AttachmentItem = {
        id: `att-${Date.now()}`,
        ...attachment,
        requestId,
        createdAt: new Date().toISOString()
      };
      const list = inMemoryAttachments.get(requestId) || [];
      list.push(fallback);
      inMemoryAttachments.set(requestId, list);
      return fallback;
    }

    return {
      id: data.id,
      requestId: data.request_id,
      fileName: data.file_name,
      fileSize: data.file_size || 0,
      fileType: data.file_type,
      fileUrl: data.file_url,
      uploadedById: data.uploaded_by_id,
      uploadedByName: data.uploaded_by_name,
      createdAt: data.created_at
    };
  }

  async getAttachments(organizationId: string, requestId: string): Promise<AttachmentItem[]> {
    const { data, error } = await this.db
      .from('attachments')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      return inMemoryAttachments.get(requestId) || [];
    }

    return data.map(r => ({
      id: r.id,
      requestId: r.request_id,
      fileName: r.file_name,
      fileSize: r.file_size || 0,
      fileType: r.file_type || 'application/octet-stream',
      fileUrl: r.file_url || '',
      uploadedById: r.uploaded_by_id,
      uploadedByName: r.uploaded_by_name,
      createdAt: r.created_at
    }));
  }
}

// ────────────────────────────────────────────────────
//  TASK REPOSITORY
// ────────────────────────────────────────────────────
export class SupabaseTaskRepository implements ITaskRepository {
  private db = getSupabaseClient();

  async findById(organizationId: string, id: string): Promise<TaskItem | null> {
    const { data, error } = await this.db
      .from('tasks')
      .select('*')
      .eq('organization_id', organizationId)
      .or(`id.eq.${id},task_id.eq.${id}`)
      .single();
    if (error || !data) return null;
    return mapRow<TaskItem>(data);
  }

  async findAll(organizationId: string, filters?: {
    departmentId?: string;
    assigneeId?: string;
    requestId?: string;
    status?: string;
  }): Promise<TaskItem[]> {
    let q = this.db.from('tasks').select('*');
    if (organizationId && organizationId !== 'ALL') {
      q = q.eq('organization_id', organizationId);
    }
    if (filters?.departmentId) q = q.eq('department_id', filters.departmentId);
    if (filters?.assigneeId)   q = q.eq('assignee_id', filters.assigneeId);
    if (filters?.requestId)    q = q.eq('request_id', filters.requestId);
    if (filters?.status)       q = q.eq('status', filters.status);
    q = q.order('created_at', { ascending: false });

    const { data, error } = await q;
    if (error || !data) return [];
    return mapRows<TaskItem>(data);
  }

  async create(data: Omit<TaskItem, 'id' | 'taskId' | 'createdAt' | 'updatedAt'>): Promise<TaskItem> {
    const { data: seqRow } = await this.db.rpc('nextval', { seq: 'task_seq' }).single() as any;
    const seq = seqRow ?? Date.now();
    const taskId = `TSK-${seq}`;

    const { data: row, error } = await this.db
      .from('tasks')
      .insert({
        task_id: taskId,
        request_id: data.requestId,
        request_title: data.requestTitle,
        organization_id: data.organizationId,
        department_id: data.departmentId,
        title: data.title,
        description: data.description,
        task_type: data.taskType,
        assignee_id: data.assigneeId,
        assignee_name: data.assigneeName,
        created_by_id: data.createdById,
        created_by_name: data.createdByName,
        status: data.status || 'TODO',
        due_date: data.dueDate
      })
      .select()
      .single();

    if (error || !row) throw new Error(error?.message || 'Failed to create task');
    return mapRow<TaskItem>(row);
  }

  async update(organizationId: string, id: string, updates: Partial<TaskItem>): Promise<TaskItem | null> {
    const colMap: Record<string, string> = {
      status: 'status',
      resultNotes: 'result_notes',
      completedAt: 'completed_at',
      dueDate: 'due_date',
      assigneeId: 'assignee_id',
      assigneeName: 'assignee_name',
      title: 'title',
      description: 'description'
    };

    const patch: Record<string, any> = {};
    for (const [camel, snake] of Object.entries(colMap)) {
      if ((updates as any)[camel] !== undefined) {
        patch[snake] = (updates as any)[camel];
      }
    }

    if (Object.keys(patch).length === 0) return this.findById(organizationId, id);

    const { data, error } = await this.db
      .from('tasks')
      .update(patch)
      .eq('organization_id', organizationId)
      .or(`id.eq.${id},task_id.eq.${id}`)
      .select()
      .single();

    if (error || !data) return null;
    return mapRow<TaskItem>(data);
  }
}

// ────────────────────────────────────────────────────
//  WORKFLOW REPOSITORY
// ────────────────────────────────────────────────────
export class SupabaseWorkflowRepository implements IWorkflowRepository {
  private db = getSupabaseClient();

  async findAll(organizationId: string): Promise<WorkflowTemplate[]> {
    const { data, error } = await this.db
      .from('workflow_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return Promise.all(data.map(r => assembleWorkflow(this.db, r)));
  }

  async findById(organizationId: string, id: string): Promise<WorkflowTemplate | null> {
    const { data, error } = await this.db
      .from('workflow_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return assembleWorkflow(this.db, data);
  }

  async create(data: Omit<WorkflowTemplate, 'id' | 'createdAt'>): Promise<WorkflowTemplate> {
    const { data: row, error } = await this.db
      .from('workflow_templates')
      .insert({
        organization_id: data.organizationId,
        name: data.name,
        description: data.description,
        department_id: data.departmentId
      })
      .select()
      .single();

    if (error || !row) throw new Error(error?.message || 'Failed to create workflow');

    // Insert steps
    if (data.steps && data.steps.length > 0) {
      const stepRows = data.steps.map(s => ({
        template_id: row.id,
        step_order: s.stepOrder,
        name: s.name,
        description: s.description,
        department_id: s.departmentId,
        required_role: s.requiredRole,
        requires_approval: s.requiresApproval || false,
        sla_hours: s.slaHours
      }));
      await this.db.from('workflow_steps').insert(stepRows);
    }

    return assembleWorkflow(this.db, row);
  }
}

// ────────────────────────────────────────────────────
//  DEPARTMENT REPOSITORY
// ────────────────────────────────────────────────────
export class SupabaseDepartmentRepository implements IDepartmentRepository {
  private db = getSupabaseClient();

  async findAll(organizationId: string): Promise<Department[]> {
    let q = this.db.from('departments').select('*');
    if (organizationId && organizationId !== 'ALL') {
      q = q.eq('organization_id', organizationId);
    }
    const { data, error } = await q.order('created_at', { ascending: true });
    if (error || !data) return [];
    return Promise.all(data.map(r => assembleDepartment(this.db, r)));
  }

  async findById(organizationId: string, id: string): Promise<Department | null> {
    const { data, error } = await this.db
      .from('departments')
      .select('*')
      .eq('organization_id', organizationId)
      .or(`id.eq.${id},code.ilike.${id}`)
      .single();
    if (error || !data) return null;
    return assembleDepartment(this.db, data);
  }

  async create(organizationId: string, data: Omit<Department, 'id' | 'createdAt' | 'organizationId'>): Promise<Department> {
    const code = data.code.toUpperCase();
    const effectivePolicy = data.approvalPolicy || (data.requiresApproval ? 'APPROVAL_REQUIRED' : 'DIRECT');
    const metaDesc = `__WP_META__:${JSON.stringify({
      text: data.description || '',
      faculty: data.faculty,
      approvalPolicy: effectivePolicy
    })}`;

    const { data: row, error } = await this.db
      .from('departments')
      .insert({
        organization_id: organizationId,
        name: data.name,
        code,
        description: metaDesc,
        manager_id: data.managerId,
        manager_name: data.managerName,
        responsibilities: data.responsibilities || [],
        task_types: data.taskTypes || [],
        employee_ids: data.employeeIds || []
      })
      .select()
      .single();

    if (error || !row) throw new Error(error?.message || 'Failed to create department');

    // Insert request types
    if (data.requestTypes && data.requestTypes.length > 0) {
      const rtRows = data.requestTypes.map(rt => ({
        department_id: row.id,
        name: rt.name,
        description: JSON.stringify({
          approvalPolicy: rt.approvalPolicy || (rt.requiresApproval ? 'MULTI_TIER_CHAIN' : 'DIRECT'),
          requiresApproval: rt.approvalPolicy && rt.approvalPolicy !== 'DIRECT' ? true : (rt.requiresApproval || false),
          slaHours: (rt as any).slaHours || 48,
          text: rt.description || ''
        }),
        default_priority: rt.defaultPriority || 'MEDIUM',
        default_workflow_id: rt.defaultWorkflowId || null
      }));
      const { error: rtErr } = await this.db.from('department_request_types').insert(rtRows);
      if (rtErr) {
        console.error('Failed to insert department_request_types:', rtErr);
      }
    }

    // If manager assigned, update user record
    if (data.managerId) {
      await this.db
        .from('users')
        .update({ role: 'MANAGER', department_id: row.id })
        .eq('id', data.managerId);
    }

    return assembleDepartment(this.db, row);
  }

  async update(organizationId: string, id: string, data: Partial<Department>): Promise<Department | null> {
    const patch: Record<string, any> = {};
    if (data.name !== undefined)            patch['name'] = data.name;
    if (data.description !== undefined || data.faculty !== undefined || data.approvalPolicy !== undefined) {
      const existing = await this.findById(organizationId, id);
      const text = data.description !== undefined ? data.description : (existing?.description || '');
      const faculty = data.faculty !== undefined ? data.faculty : existing?.faculty;
      const approvalPolicy = data.approvalPolicy !== undefined ? data.approvalPolicy : existing?.approvalPolicy;
      patch['description'] = `__WP_META__:${JSON.stringify({ text, faculty, approvalPolicy })}`;
    }
    if (data.responsibilities !== undefined) patch['responsibilities'] = data.responsibilities;
    if (data.taskTypes !== undefined)       patch['task_types'] = data.taskTypes;
    if (data.employeeIds !== undefined)     patch['employee_ids'] = data.employeeIds;
    if (data.managerId !== undefined)       patch['manager_id'] = data.managerId;
    if (data.managerName !== undefined)     patch['manager_name'] = data.managerName;

    if (Object.keys(patch).length > 0) {
      const { error } = await this.db
        .from('departments')
        .update(patch)
        .eq('organization_id', organizationId)
        .eq('id', id);
      if (error) return null;
    }

    // Update request types if provided
    if (data.requestTypes !== undefined) {
      await this.db.from('department_request_types').delete().eq('department_id', id);
      if (data.requestTypes.length > 0) {
        const rtRows = data.requestTypes.map(rt => ({
          department_id: id,
          name: rt.name,
          description: JSON.stringify({
            approvalPolicy: rt.approvalPolicy || (rt.requiresApproval ? 'MULTI_TIER_CHAIN' : 'DIRECT'),
            requiresApproval: rt.approvalPolicy && rt.approvalPolicy !== 'DIRECT' ? true : (rt.requiresApproval || false),
            slaHours: (rt as any).slaHours || 48,
            text: rt.description || ''
          }),
          default_priority: rt.defaultPriority || 'MEDIUM',
          default_workflow_id: rt.defaultWorkflowId || null
        }));
        const { error: rtErr } = await this.db.from('department_request_types').insert(rtRows);
        if (rtErr) {
          console.error('Failed to update department_request_types:', rtErr);
        }
      }
    }

    return this.findById(organizationId, id);
  }

  async assignManager(organizationId: string, departmentId: string, managerId: string, managerName: string): Promise<Department | null> {
    const current = await this.findById(organizationId, departmentId);
    if (current && current.managerId && current.managerId !== managerId) {
      await this.db
        .from('users')
        .update({ role: 'EMPLOYEE' })
        .eq('id', current.managerId);
    }

    const { error } = await this.db
      .from('departments')
      .update({ manager_id: managerId, manager_name: managerName })
      .eq('organization_id', organizationId)
      .eq('id', departmentId);
    if (error) return null;

    // Update user role
    await this.db
      .from('users')
      .update({ role: 'MANAGER', department_id: departmentId })
      .eq('id', managerId);

    return this.findById(organizationId, departmentId);
  }

  async vacateManager(organizationId: string, departmentId: string): Promise<Department | null> {
    const current = await this.findById(organizationId, departmentId);
    if (current && current.managerId) {
      await this.db
        .from('users')
        .update({ role: 'EMPLOYEE' })
        .eq('id', current.managerId);
    }

    const { error } = await this.db
      .from('departments')
      .update({ manager_id: null, manager_name: null })
      .eq('organization_id', organizationId)
      .eq('id', departmentId);
    if (error) return null;

    return this.findById(organizationId, departmentId);
  }
}

// ────────────────────────────────────────────────────
//  USER REPOSITORY
// ────────────────────────────────────────────────────
export class SupabaseUserRepository implements IUserRepository {
  private db = getSupabaseClient();

  private mapUser(row: Record<string, any>): User {
    let effectiveRole = row.role;
    let cleanAvatar = row.avatar_url;
    let faculty = row.faculty || undefined;
    if (row.avatar_url && typeof row.avatar_url === 'string' && row.avatar_url.includes('#')) {
      const [baseUrl, hash] = row.avatar_url.split('#');
      cleanAvatar = baseUrl || null;
      const params = new URLSearchParams(hash);
      if (params.get('role')) {
        effectiveRole = params.get('role') as any;
      }
      if (params.get('faculty')) {
        faculty = decodeURIComponent(params.get('faculty')!);
      }
    }
    return {
      id: row.id,
      organizationId: row.organization_id,
      departmentId: row.department_id,
      faculty,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      role: effectiveRole,
      avatarUrl: cleanAvatar,
      createdAt: row.created_at
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .ilike('email', email)
      .single();
    if (error || !data) return null;
    return this.mapUser(data);
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return this.mapUser(data);
  }

  async findAll(organizationId: string): Promise<User[]> {
    let q = this.db.from('users').select('*');
    if (organizationId && organizationId !== 'ALL') {
      q = q.eq('organization_id', organizationId);
    }
    const { data, error } = await q.order('name', { ascending: true });
    if (error || !data) return [];
    return data.map(r => this.mapUser(r));
  }

  async create(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const isCustomRole = user.role === 'DEAN';
    const dbRole = isCustomRole ? 'ORG_ADMIN' : user.role;
    const dbAvatarUrl = isCustomRole
      ? (user.avatarUrl ? `${user.avatarUrl}#role=DEAN` : `#role=DEAN`)
      : (user.avatarUrl || null);

    const { data, error } = await this.db
      .from('users')
      .insert({
        organization_id: user.organizationId,
        department_id: user.departmentId || null,
        email: user.email,
        password_hash: user.passwordHash,
        name: user.name,
        role: dbRole,
        avatar_url: dbAvatarUrl
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create user in Supabase: ${error?.message || 'Unknown error'}`);
    }
    return this.mapUser(data);
  }

  async updateRoleAndDepartment(userId: string, role: User['role'], departmentId?: string, faculty?: string): Promise<User | null> {
    const isCustomRole = role === 'DEAN';
    const dbRole = isCustomRole ? 'ORG_ADMIN' : role;
    const existing = await this.findById(userId);
    let avatarUrl = existing?.avatarUrl || null;
    if (avatarUrl && avatarUrl.includes('#')) {
      avatarUrl = avatarUrl.split('#')[0] || null;
    }
    const tags: string[] = [];
    if (isCustomRole) tags.push(`role=DEAN`);
    const effectiveFaculty = faculty !== undefined ? faculty : existing?.faculty;
    if (effectiveFaculty) tags.push(`faculty=${encodeURIComponent(effectiveFaculty)}`);
    if (tags.length > 0) {
      avatarUrl = avatarUrl ? `${avatarUrl}#${tags.join('&')}` : `#${tags.join('&')}`;
    }

    const patch: Record<string, any> = { role: dbRole, avatar_url: avatarUrl };
    if (departmentId !== undefined) patch['department_id'] = departmentId;

    const { data, error } = await this.db
      .from('users')
      .update(patch)
      .eq('id', userId)
      .select()
      .single();
    if (error || !data) return null;
    return this.mapUser(data);
  }
}

// ────────────────────────────────────────────────────
//  NOTIFICATION REPOSITORY
// ────────────────────────────────────────────────────
export class SupabaseNotificationRepository implements INotificationRepository {
  private db = getSupabaseClient();

  private mapNotif(row: Record<string, any>): NotificationItem {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      title: row.title,
      message: row.message,
      type: row.type,
      link: row.link,
      read: row.read,
      createdAt: row.created_at
    };
  }

  async getUserNotifications(userId: string): Promise<NotificationItem[]> {
    const { data, error } = await this.db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data.map(r => this.mapNotif(r));
  }

  async create(notification: Omit<NotificationItem, 'id' | 'createdAt'>): Promise<NotificationItem> {
    const { data, error } = await this.db
      .from('notifications')
      .insert({
        user_id: notification.userId,
        organization_id: notification.organizationId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link,
        read: notification.read || false
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to create notification');
    return this.mapNotif(data);
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const { error } = await this.db
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId);
    return !error;
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    const { error } = await this.db
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    return !error;
  }
}

// ────────────────────────────────────────────────────
//  AUDIT REPOSITORY
// ────────────────────────────────────────────────────
export class SupabaseAuditRepository implements IAuditRepository {
  private db = getSupabaseClient();

  private mapLog(row: Record<string, any>): AuditLog {
    return {
      id: row.id,
      organizationId: row.organization_id,
      actorId: row.actor_id,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      details: row.details,
      timestamp: row.timestamp
    };
  }

  async findAll(organizationId: string, filters?: { actorId?: string; resourceType?: string; limit?: number }): Promise<AuditLog[]> {
    let q = this.db.from('audit_logs').select('*');
    if (organizationId && organizationId !== 'ALL') {
      q = q.eq('organization_id', organizationId);
    }

    if (filters?.actorId)      q = q.eq('actor_id', filters.actorId);
    if (filters?.resourceType) q = q.eq('resource_type', filters.resourceType);

    q = q.order('timestamp', { ascending: false }).limit(filters?.limit || 100);

    const { data, error } = await q;
    if (error || !data) return [];
    return data.map(r => this.mapLog(r));
  }

  async log(organizationId: string, actor: { id: string; name: string; role: string }, action: string, resourceType: string, resourceId: string, details?: any): Promise<AuditLog> {
    const { data, error } = await this.db
      .from('audit_logs')
      .insert({
        organization_id: organizationId,
        actor_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details: details || null
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to log audit entry');
    return this.mapLog(data);
  }

  async logAiAction(organizationId: string, userId: string, toolName: string, params: any, confirmed: boolean, summary: string): Promise<void> {
    const user = await new SupabaseUserRepository().findById(userId);
    await this.log(
      organizationId,
      { id: userId, name: user?.name || 'User', role: user?.role || 'EMPLOYEE' },
      'AI_TOOL_EXECUTED',
      'PulseAI',
      toolName,
      { toolName, params, confirmed, summary }
    );
  }
}

// ────────────────────────────────────────────────────
//  ORGANIZATION REPOSITORY
// ────────────────────────────────────────────────────
export class SupabaseOrganizationRepository implements IOrganizationRepository {
  private db = getSupabaseClient();

  private mapOrg(row: Record<string, any>): Organization {
    let orgType: string | undefined = row.org_type;
    if (!orgType && row.plan && typeof row.plan === 'string') {
      const match = row.plan.replace(/^type:/, '').split(':')[0].toUpperCase();
      if (['COMPANY', 'UNIVERSITY', 'SCHOOL', 'HOSPITAL', 'GOVERNMENT', 'NGO'].includes(match)) {
        orgType = match;
      }
    }
    if (!orgType || orgType === 'COMPANY') {
      const inferred = inferOrgTypeFromName(row.name);
      if (inferred !== 'COMPANY') {
        orgType = inferred;
      }
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan || 'enterprise',
      orgType: orgType || 'COMPANY',
      createdAt: row.created_at
    };
  }

  async findById(id: string): Promise<Organization | null> {
    const { data, error } = await this.db
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return this.mapOrg(data);
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const { data, error } = await this.db
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error || !data) return null;
    return this.mapOrg(data);
  }

  async findAll(): Promise<Organization[]> {
    const { data, error } = await this.db
      .from('organizations')
      .select('*')
      .order('name', { ascending: true });
    if (error || !data) return [];
    return data.map(r => this.mapOrg(r));
  }

  async create(data: { name: string; slug?: string; orgType?: string }): Promise<Organization> {
    const baseSlug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let orgType = data.orgType;
    if (!orgType || orgType === 'COMPANY') {
      const inferred = inferOrgTypeFromName(data.name);
      if (inferred !== 'COMPANY') {
        orgType = inferred;
      }
    }
    orgType = orgType || 'COMPANY';
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    const plan = `type:${orgType}:enterprise`;
    const row = { name: data.name, slug, plan, org_type: orgType };

    let { data: created, error } = await this.db.from('organizations').insert(row).select().single();

    // Fallback for databases where the org_type migration hasn't been applied yet
    if (error && /org_type/i.test(error.message || '')) {
      console.warn('  ⚠️  organizations.org_type column missing. Storing in plan column instead.');
      const { org_type, ...legacyRow } = row;
      ({ data: created, error } = await this.db.from('organizations').insert(legacyRow).select().single());
    }

    if (error || !created) throw new Error(error?.message || 'Failed to create organization');
    return this.mapOrg(created);
  }
}

export async function wipeSupabaseOrgData(organizationId: string, options: { wipeDepartments?: boolean } = {}): Promise<void> {
  const db = getSupabaseClient();
  // Delete all tasks, timeline events, comments, approvals, requests
  await db.from('tasks').delete().eq('organization_id', organizationId);
  await db.from('requests').delete().eq('organization_id', organizationId);
  await db.from('notifications').delete().eq('organization_id', organizationId);
  await db.from('audit_logs').delete().eq('organization_id', organizationId);
  if (options.wipeDepartments) {
    await db.from('departments').delete().eq('organization_id', organizationId);
  }
}
