import {
  RequestItem,
  WorkflowTemplate,
  Department,
  User,
  Organization,
  TimelineEvent,
  Comment,
  Approval,
  NotificationItem,
  TaskItem,
  AuditLog,
  AttachmentItem
} from '../types';

export interface IOrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  findAll(): Promise<Organization[]>;
  create(data: { name: string; slug?: string; orgType?: string }): Promise<Organization>;
}

export interface IRequestRepository {
  findById(organizationId: string, id: string): Promise<RequestItem | null>;
  findByRequestId(organizationId: string, requestId: string): Promise<RequestItem | null>;
  findAll(organizationId: string, filters?: {
    status?: string;
    departmentId?: string;
    assigneeId?: string;
    requesterId?: string;
    priority?: string;
    isOverdue?: boolean;
    isWaiting?: boolean;
  }): Promise<RequestItem[]>;
  create(data: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt' | 'timeline' | 'comments' | 'approvals' | 'tasks' | 'attachments'>): Promise<RequestItem>;
  update(organizationId: string, id: string, updates: Partial<RequestItem>): Promise<RequestItem | null>;
  addTimelineEvent(organizationId: string, requestId: string, event: Omit<TimelineEvent, 'id' | 'timestamp' | 'requestId'>): Promise<TimelineEvent>;
  addComment(organizationId: string, requestId: string, comment: Omit<Comment, 'id' | 'createdAt' | 'requestId'>): Promise<Comment>;
  addApproval(organizationId: string, requestId: string, approval: Omit<Approval, 'id' | 'createdAt'>): Promise<Approval>;
  updateApproval(organizationId: string, requestId: string, approvalId: string, status: 'APPROVED' | 'REJECTED', notes?: string): Promise<Approval | null>;
  addTask(organizationId: string, requestId: string, task: TaskItem): Promise<TaskItem>;
  updateTask(organizationId: string, requestId: string, taskId: string, updates: Partial<TaskItem>): Promise<TaskItem | null>;
  addAttachment(organizationId: string, requestId: string, attachment: Omit<AttachmentItem, 'id' | 'createdAt'>): Promise<AttachmentItem>;
  getAttachments(organizationId: string, requestId: string): Promise<AttachmentItem[]>;
}

export interface ITaskRepository {
  findById(organizationId: string, id: string): Promise<TaskItem | null>;
  findAll(organizationId: string, filters?: {
    departmentId?: string;
    assigneeId?: string;
    requestId?: string;
    status?: string;
  }): Promise<TaskItem[]>;
  create(data: Omit<TaskItem, 'id' | 'taskId' | 'createdAt' | 'updatedAt'>): Promise<TaskItem>;
  update(organizationId: string, id: string, updates: Partial<TaskItem>): Promise<TaskItem | null>;
}

export interface IWorkflowRepository {
  findAll(organizationId: string): Promise<WorkflowTemplate[]>;
  findById(organizationId: string, id: string): Promise<WorkflowTemplate | null>;
  create(data: Omit<WorkflowTemplate, 'id' | 'createdAt'>): Promise<WorkflowTemplate>;
}

export interface IDepartmentRepository {
  findAll(organizationId: string): Promise<Department[]>;
  findById(organizationId: string, id: string): Promise<Department | null>;
  create(organizationId: string, data: Omit<Department, 'id' | 'createdAt' | 'organizationId'>): Promise<Department>;
  update(organizationId: string, id: string, data: Partial<Department>): Promise<Department | null>;
  assignManager(organizationId: string, departmentId: string, managerId: string, managerName: string): Promise<Department | null>;
  vacateManager(organizationId: string, departmentId: string): Promise<Department | null>;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findAll(organizationId: string): Promise<User[]>;
  create(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;
  updateRoleAndDepartment(userId: string, role: User['role'], departmentId?: string, faculty?: string): Promise<User | null>;
  updateProfile(userId: string, data: { name?: string; passwordHash?: string; avatarUrl?: string }): Promise<User | null>;
}

export interface INotificationRepository {
  getUserNotifications(userId: string): Promise<NotificationItem[]>;
  create(notification: Omit<NotificationItem, 'id' | 'createdAt'>): Promise<NotificationItem>;
  markAsRead(id: string, userId: string): Promise<boolean>;
  markAllAsRead(userId: string): Promise<boolean>;
}

export interface IAuditRepository {
  findAll(organizationId: string, filters?: { actorId?: string; resourceType?: string; limit?: number }): Promise<AuditLog[]>;
  log(organizationId: string, actor: { id: string; name: string; role: string }, action: string, resourceType: string, resourceId: string, details?: any): Promise<AuditLog>;
  logAiAction(organizationId: string, userId: string, toolName: string, params: any, confirmed: boolean, summary: string): Promise<void>;
}
