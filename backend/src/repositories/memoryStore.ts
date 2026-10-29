import {
  Organization,
  Department,
  User,
  WorkflowTemplate,
  RequestItem,
  NotificationItem,
  TaskItem,
  AuditLog,
  TimelineEvent,
  Comment,
  Approval,
  ApprovalPolicy,
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

// Initial Organizations
const organizations: Organization[] = [
  {
    id: 'org-acme-1',
    name: 'Acme Technologies Inc.',
    slug: 'acme',
    plan: 'enterprise',
    orgType: 'COMPANY',
    createdAt: '2026-01-01T00:00:00Z'
  }
];

// Initial Users (Only Root Super Admin)
let users: User[] = [
  {
    id: 'user-superadmin',
    organizationId: 'org-acme-1',
    email: 'admin@acme.com',
    passwordHash: '$2a$10$S.Y8G2/VOd3rkxQ13MEvcOQ46lIdmvnbcQa3Nve/LGEeASQsXDSXe',
    name: 'System Administrator',
    role: 'SUPER_ADMIN',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&fit=crop',
    createdAt: '2026-01-01T00:00:00Z'
  }
];

// Initial Configurable Departments (Clean Slate)
let departments: Department[] = [];

// Workflow Templates (Clean Slate)
let workflows: WorkflowTemplate[] = [];

// Initial Tasks (Clean Slate)
let tasks: TaskItem[] = [];

// Initial Requests (Clean Slate)
let requests: RequestItem[] = [];

// Initial Audit Logs (Clean Slate)
let auditLogs: AuditLog[] = [];

// Initial Notifications (Clean Slate)
let notifications: NotificationItem[] = [];

// Implementation of Repositories

export class MemoryRequestRepository implements IRequestRepository {
  async findById(organizationId: string, id: string): Promise<RequestItem | null> {
    const item = requests.find(r => r.organizationId === organizationId && (r.id === id || r.requestId === id));
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async findByRequestId(organizationId: string, requestId: string): Promise<RequestItem | null> {
    const item = requests.find(r => r.organizationId === organizationId && r.requestId.toUpperCase() === requestId.toUpperCase());
    return item ? JSON.parse(JSON.stringify(item)) : null;
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
    let result = organizationId === 'ALL' ? requests : requests.filter(r => r.organizationId === organizationId);
    const now = new Date();

    if (filters) {
      if (filters.status) result = result.filter(r => r.status === filters.status);
      if (filters.departmentId) result = result.filter(r => r.departmentId === filters.departmentId);
      if (filters.assigneeId) result = result.filter(r => r.assigneeId === filters.assigneeId);
      if (filters.requesterId) result = result.filter(r => r.requesterId === filters.requesterId);
      if (filters.priority) result = result.filter(r => r.priority === filters.priority);
      if (filters.isOverdue) result = result.filter(r => r.dueDate && new Date(r.dueDate) < now && r.status !== 'COMPLETED');
      if (filters.isWaiting) result = result.filter(r => r.status === 'WAITING' || !!r.waitingOn);
    }

    return JSON.parse(JSON.stringify(result));
  }

  async create(data: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt' | 'timeline' | 'comments' | 'approvals' | 'tasks'>): Promise<RequestItem> {
    const nextSeq = 1000 + requests.length + 1;
    const now = new Date().toISOString();
    const newRequest: RequestItem = {
      ...data,
      id: `req-uuid-${nextSeq}`,
      requestId: `REQ-${nextSeq}`,
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          id: `tl-${nextSeq}-1`,
          requestId: `REQ-${nextSeq}`,
          actorId: data.requesterId,
          actorName: data.requesterName,
          eventType: 'CREATED',
          title: 'Request Created',
          details: `Request initiated: ${data.title}`,
          timestamp: now
        }
      ],
      comments: [],
      approvals: [],
      tasks: []
    };

    requests.unshift(newRequest);
    return JSON.parse(JSON.stringify(newRequest));
  }

  async update(organizationId: string, id: string, updates: Partial<RequestItem>): Promise<RequestItem | null> {
    const idx = requests.findIndex(r => r.organizationId === organizationId && (r.id === id || r.requestId === id));
    if (idx === -1) return null;

    requests[idx] = {
      ...requests[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return JSON.parse(JSON.stringify(requests[idx]));
  }

  async addTimelineEvent(organizationId: string, requestId: string, event: Omit<TimelineEvent, 'id' | 'timestamp' | 'requestId'>): Promise<TimelineEvent> {
    const req = requests.find(r => r.organizationId === organizationId && (r.id === requestId || r.requestId === requestId));
    if (!req) throw new Error('Request not found');

    const newEvent: TimelineEvent = {
      ...event,
      requestId: req.requestId,
      id: `tl-${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    req.timeline.push(newEvent);
    req.updatedAt = newEvent.timestamp;
    return newEvent;
  }

  async addComment(organizationId: string, requestId: string, comment: Omit<Comment, 'id' | 'createdAt' | 'requestId'>): Promise<Comment> {
    const req = requests.find(r => r.organizationId === organizationId && (r.id === requestId || r.requestId === requestId));
    if (!req) throw new Error('Request not found');

    const newComment: Comment = {
      ...comment,
      requestId: req.requestId,
      id: `cmt-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    req.comments.push(newComment);
    req.updatedAt = newComment.createdAt;
    return newComment;
  }

  async addApproval(organizationId: string, requestId: string, approval: Omit<Approval, 'id' | 'createdAt'>): Promise<Approval> {
    const req = requests.find(r => r.organizationId === organizationId && (r.id === requestId || r.requestId === requestId));
    if (!req) throw new Error('Request not found');

    if (!req.approvals) req.approvals = [];
    const newApproval: Approval = {
      ...approval,
      requestId: req.requestId,
      id: `appr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString()
    };

    req.approvals.push(newApproval);
    req.updatedAt = newApproval.createdAt;
    return JSON.parse(JSON.stringify(newApproval));
  }

  async updateApproval(organizationId: string, requestId: string, approvalId: string, status: 'APPROVED' | 'REJECTED', notes?: string): Promise<Approval | null> {
    const req = requests.find(r => r.organizationId === organizationId && (r.id === requestId || r.requestId === requestId));
    if (!req) return null;

    const approval = req.approvals.find(a => a.id === approvalId);
    if (!approval) return null;

    approval.status = status;
    approval.notes = notes;
    approval.decidedAt = new Date().toISOString();
    req.updatedAt = approval.decidedAt;

    return JSON.parse(JSON.stringify(approval));
  }

  async addTask(organizationId: string, requestId: string, task: TaskItem): Promise<TaskItem> {
    const req = requests.find(r => r.organizationId === organizationId && (r.id === requestId || r.requestId === requestId));
    if (req) {
      if (!req.tasks) req.tasks = [];
      req.tasks.push(task);
      req.updatedAt = new Date().toISOString();
    }
    return task;
  }

  async updateTask(organizationId: string, requestId: string, taskId: string, updates: Partial<TaskItem>): Promise<TaskItem | null> {
    const req = requests.find(r => r.organizationId === organizationId && (r.id === requestId || r.requestId === requestId));
    if (!req || !req.tasks) return null;

    const tIdx = req.tasks.findIndex(t => t.id === taskId || t.taskId === taskId);
    if (tIdx === -1) return null;

    req.tasks[tIdx] = {
      ...req.tasks[tIdx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return JSON.parse(JSON.stringify(req.tasks[tIdx]));
  }

  async addAttachment(organizationId: string, requestId: string, attachment: Omit<AttachmentItem, 'id' | 'createdAt'>): Promise<AttachmentItem> {
    const req = requests.find(r => r.organizationId === organizationId && (r.id === requestId || r.requestId === requestId));
    if (!req) throw new Error('Request not found');

    if (!req.attachments) req.attachments = [];
    const newAttachment: AttachmentItem = {
      ...attachment,
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString()
    };

    req.attachments.push(newAttachment);
    req.updatedAt = newAttachment.createdAt;
    return JSON.parse(JSON.stringify(newAttachment));
  }

  async getAttachments(organizationId: string, requestId: string): Promise<AttachmentItem[]> {
    const req = requests.find(r => r.organizationId === organizationId && (r.id === requestId || r.requestId === requestId));
    if (!req || !req.attachments) return [];
    return JSON.parse(JSON.stringify(req.attachments));
  }
}

export class MemoryTaskRepository implements ITaskRepository {
  async findById(organizationId: string, id: string): Promise<TaskItem | null> {
    const task = tasks.find(t => t.organizationId === organizationId && (t.id === id || t.taskId === id));
    return task ? JSON.parse(JSON.stringify(task)) : null;
  }

  async findAll(organizationId: string, filters?: {
    departmentId?: string;
    assigneeId?: string;
    requestId?: string;
    status?: string;
  }): Promise<TaskItem[]> {
    let result = organizationId === 'ALL' ? tasks : tasks.filter(t => t.organizationId === organizationId);
    if (filters) {
      if (filters.departmentId) result = result.filter(t => t.departmentId === filters.departmentId);
      if (filters.assigneeId) result = result.filter(t => t.assigneeId === filters.assigneeId);
      if (filters.requestId) result = result.filter(t => t.requestId === filters.requestId);
      if (filters.status) result = result.filter(t => t.status === filters.status);
    }
    return JSON.parse(JSON.stringify(result));
  }

  async create(data: Omit<TaskItem, 'id' | 'taskId' | 'createdAt' | 'updatedAt'>): Promise<TaskItem> {
    const nextSeq = 200 + tasks.length + 1;
    const now = new Date().toISOString();
    const newTask: TaskItem = {
      ...data,
      id: `task-uuid-${nextSeq}`,
      taskId: `TSK-${nextSeq}`,
      createdAt: now,
      updatedAt: now
    };

    tasks.unshift(newTask);

    // Also sync to parent request
    const req = requests.find(r => r.organizationId === data.organizationId && r.requestId === data.requestId);
    if (req) {
      if (!req.tasks) req.tasks = [];
      req.tasks.unshift(newTask);
    }

    return JSON.parse(JSON.stringify(newTask));
  }

  async update(organizationId: string, id: string, updates: Partial<TaskItem>): Promise<TaskItem | null> {
    const idx = tasks.findIndex(t => t.organizationId === organizationId && (t.id === id || t.taskId === id));
    if (idx === -1) return null;

    tasks[idx] = {
      ...tasks[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Also sync to parent request
    const target = tasks[idx];
    const req = requests.find(r => r.organizationId === organizationId && r.requestId === target.requestId);
    if (req && req.tasks) {
      const rIdx = req.tasks.findIndex(t => t.id === target.id || t.taskId === target.taskId);
      if (rIdx !== -1) {
        req.tasks[rIdx] = { ...target };
      }
    }

    return JSON.parse(JSON.stringify(tasks[idx]));
  }
}

export class MemoryDepartmentRepository implements IDepartmentRepository {
  async findAll(organizationId: string): Promise<Department[]> {
    return JSON.parse(JSON.stringify(organizationId === 'ALL' ? departments : departments.filter(d => d.organizationId === organizationId)));
  }

  async findById(organizationId: string, id: string): Promise<Department | null> {
    const dept = departments.find(d => d.organizationId === organizationId && (d.id === id || d.code.toUpperCase() === id.toUpperCase()));
    return dept ? JSON.parse(JSON.stringify(dept)) : null;
  }

  async create(organizationId: string, data: Omit<Department, 'id' | 'createdAt' | 'organizationId'>): Promise<Department> {
    const code = data.code.toUpperCase();
    const id = `dept-${code.toLowerCase()}`;
    const effectivePolicy: ApprovalPolicy = data.approvalPolicy || (data.requiresApproval ? 'DEPT_MANAGER' : 'DIRECT');
    const newDept: Department = {
      ...data,
      id,
      code,
      organizationId,
      faculty: data.faculty,
      approvalPolicy: effectivePolicy,
      requiresApproval: effectivePolicy !== 'DIRECT',
      createdAt: new Date().toISOString()
    };

    departments.push(newDept);

    // If manager assigned, update manager's user record
    if (data.managerId) {
      const mgr = users.find(u => u.id === data.managerId);
      if (mgr) {
        mgr.role = 'MANAGER';
        mgr.departmentId = id;
      }
    }

    return JSON.parse(JSON.stringify(newDept));
  }

  async update(organizationId: string, id: string, data: Partial<Department>): Promise<Department | null> {
    const idx = departments.findIndex(d => d.organizationId === organizationId && d.id === id);
    if (idx === -1) return null;

    departments[idx] = {
      ...departments[idx],
      ...data,
      ...(data.approvalPolicy ? {
        approvalPolicy: data.approvalPolicy,
        requiresApproval: data.approvalPolicy !== 'DIRECT'
      } : {})
    };

    return JSON.parse(JSON.stringify(departments[idx]));
  }

  async assignManager(organizationId: string, departmentId: string, managerId: string, managerName: string): Promise<Department | null> {
    const dept = departments.find(d => d.organizationId === organizationId && d.id === departmentId);
    if (!dept) return null;

    // Transition former manager to regular employee
    const prevManagerId = dept.managerId;
    if (prevManagerId && prevManagerId !== managerId) {
      const prevUser = users.find(u => u.id === prevManagerId);
      if (prevUser && prevUser.role === 'MANAGER') {
        prevUser.role = 'EMPLOYEE';
      }
    }

    dept.managerId = managerId;
    dept.managerName = managerName;

    // Enforce in User entity
    const user = users.find(u => u.id === managerId);
    if (user) {
      user.role = 'MANAGER';
      user.departmentId = departmentId;
    }

    return JSON.parse(JSON.stringify(dept));
  }

  async vacateManager(organizationId: string, departmentId: string): Promise<Department | null> {
    const dept = departments.find(d => d.organizationId === organizationId && d.id === departmentId);
    if (!dept) return null;

    const prevManagerId = dept.managerId;
    dept.managerId = undefined;
    dept.managerName = undefined;

    if (prevManagerId) {
      const prevUser = users.find(u => u.id === prevManagerId);
      if (prevUser && prevUser.role === 'MANAGER') {
        prevUser.role = 'EMPLOYEE';
      }
    }

    return JSON.parse(JSON.stringify(dept));
  }
}

export class MemoryWorkflowRepository implements IWorkflowRepository {
  async findAll(organizationId: string): Promise<WorkflowTemplate[]> {
    return JSON.parse(JSON.stringify(workflows.filter(w => w.organizationId === organizationId)));
  }

  async findById(organizationId: string, id: string): Promise<WorkflowTemplate | null> {
    const wf = workflows.find(w => w.organizationId === organizationId && w.id === id);
    return wf ? JSON.parse(JSON.stringify(wf)) : null;
  }

  async create(data: Omit<WorkflowTemplate, 'id' | 'createdAt'>): Promise<WorkflowTemplate> {
    const newWf: WorkflowTemplate = {
      ...data,
      id: `wf-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    workflows.push(newWf);
    return JSON.parse(JSON.stringify(newWf));
  }
}

export class MemoryUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    return user ? JSON.parse(JSON.stringify(user)) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = users.find(u => u.id === id);
    return user ? JSON.parse(JSON.stringify(user)) : null;
  }

  async findAll(organizationId: string): Promise<User[]> {
    return JSON.parse(JSON.stringify(organizationId === 'ALL' ? users : users.filter(u => u.organizationId === organizationId)));
  }

  async create(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const newUser: User = {
      ...user,
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    return JSON.parse(JSON.stringify(newUser));
  }

  async updateRoleAndDepartment(userId: string, role: User['role'], departmentId?: string, faculty?: string): Promise<User | null> {
    const user = users.find(u => u.id === userId);
    if (!user) return null;

    user.role = role;
    if (departmentId !== undefined) {
      user.departmentId = departmentId;
    }
    if (faculty !== undefined) {
      user.faculty = faculty;
    }
    return JSON.parse(JSON.stringify(user));
  }
}

export class MemoryNotificationRepository implements INotificationRepository {
  async getUserNotifications(userId: string): Promise<NotificationItem[]> {
    return JSON.parse(JSON.stringify(notifications.filter(n => n.userId === userId)));
  }

  async create(notification: Omit<NotificationItem, 'id' | 'createdAt'>): Promise<NotificationItem> {
    const newNotif: NotificationItem = {
      ...notification,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString()
    };
    notifications.unshift(newNotif);
    return JSON.parse(JSON.stringify(newNotif));
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const item = notifications.find(n => n.id === id && n.userId === userId);
    if (!item) return false;
    item.read = true;
    return true;
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    notifications.filter(n => n.userId === userId).forEach(n => { n.read = true; });
    return true;
  }
}

export class MemoryAuditRepository implements IAuditRepository {
  async findAll(organizationId: string, filters?: { actorId?: string; resourceType?: string; limit?: number }): Promise<AuditLog[]> {
    let result = organizationId === 'ALL' ? auditLogs : auditLogs.filter(a => a.organizationId === organizationId);
    if (filters) {
      if (filters.actorId) result = result.filter(a => a.actorId === filters.actorId);
      if (filters.resourceType) result = result.filter(a => a.resourceType === filters.resourceType);
    }
    const limit = filters?.limit || 100;
    return JSON.parse(JSON.stringify(result.slice(0, limit)));
  }

  async log(organizationId: string, actor: { id: string; name: string; role: string }, action: string, resourceType: string, resourceId: string, details?: any): Promise<AuditLog> {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organizationId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      resourceType,
      resourceId,
      details,
      timestamp: new Date().toISOString()
    };
    auditLogs.unshift(newLog);
    return JSON.parse(JSON.stringify(newLog));
  }

  async logAiAction(organizationId: string, userId: string, toolName: string, params: any, confirmed: boolean, summary: string): Promise<void> {
    const user = users.find(u => u.id === userId);
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
export class MemoryOrganizationRepository implements IOrganizationRepository {
  async findById(id: string): Promise<Organization | null> {
    const org = organizations.find(o => o.id === id);
    return org ? JSON.parse(JSON.stringify(org)) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const org = organizations.find(o => o.slug === slug);
    return org ? JSON.parse(JSON.stringify(org)) : null;
  }

  async findAll(): Promise<Organization[]> {
    return JSON.parse(JSON.stringify(organizations));
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
    const newOrg: Organization = {
      id: `org-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: data.name,
      slug: `${baseSlug}-${Date.now().toString().slice(-4)}`,
      plan: `type:${orgType}:enterprise`,
      orgType,
      createdAt: new Date().toISOString()
    };
    organizations.push(newOrg);
    return JSON.parse(JSON.stringify(newOrg));
  }
}

export function wipeMemoryOrgData(organizationId: string, options: { wipeDepartments?: boolean } = {}): void {
  // Clear requests, tasks, notifications, audit logs for organization
  for (let i = requests.length - 1; i >= 0; i--) {
    if (requests[i].organizationId === organizationId) {
      requests.splice(i, 1);
    }
  }
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].organizationId === organizationId) {
      tasks.splice(i, 1);
    }
  }
  for (let i = notifications.length - 1; i >= 0; i--) {
    if (notifications[i].organizationId === organizationId) {
      notifications.splice(i, 1);
    }
  }
  for (let i = auditLogs.length - 1; i >= 0; i--) {
    if (auditLogs[i].organizationId === organizationId) {
      auditLogs.splice(i, 1);
    }
  }
  if (options.wipeDepartments) {
    for (let i = departments.length - 1; i >= 0; i--) {
      if (departments[i].organizationId === organizationId) {
        departments.splice(i, 1);
      }
    }
  }
}

