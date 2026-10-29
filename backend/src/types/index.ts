// WorkPulse Core Domain Types

export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEAN' | 'MANAGER' | 'EMPLOYEE' | 'OPERATOR';

export type RequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ACTIVE'
  | 'WAITING'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

export interface User {
  id: string;
  organizationId: string;
  departmentId?: string;
  faculty?: string;
  email: string;
  passwordHash?: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  /** COMPANY | UNIVERSITY | SCHOOL | HOSPITAL | GOVERNMENT | NGO */
  orgType: string;
  createdAt: string;
}

export type ApprovalPolicy = 'DIRECT' | 'DEPT_MANAGER' | 'DEAN' | 'EXECUTIVE_ONLY' | 'MULTI_TIER_CHAIN';

export interface Faculty {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  deanId?: string;
  deanName?: string;
  departmentCount?: number;
  createdAt: string;
}

export interface DepartmentRequestType {
  id: string;
  name: string;
  description?: string;
  defaultPriority?: RequestPriority;
  defaultWorkflowId?: string;
  approvalPolicy?: ApprovalPolicy;
  requiresApproval?: boolean;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string;
  faculty?: string;
  approvalPolicy?: ApprovalPolicy;
  requiresApproval?: boolean;
  managerId?: string;
  managerName?: string;
  responsibilities: string[];
  requestTypes: DepartmentRequestType[];
  taskTypes: string[];
  employeeIds?: string[];
  createdAt: string;
}

export interface WorkflowStep {
  id: string;
  templateId: string;
  stepOrder: number;
  name: string;
  description?: string;
  departmentId?: string;
  requiredRole?: UserRole;
  requiresApproval?: boolean;
  slaHours: number;
}

export interface WorkflowTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  departmentId?: string;
  steps: WorkflowStep[];
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  requestId: string;
  actorId?: string;
  actorName?: string;
  eventType: 'CREATED' | 'ASSIGNED' | 'STATUS_CHANGE' | 'STAGE_TRANSITION' | 'WAITING_ON' | 'COMMENT' | 'APPROVAL' | 'TASK_ASSIGNED' | 'TASK_COMPLETED' | 'SLA_BREACH';
  title: string;
  details?: string;
  timestamp: string;
}

export interface Comment {
  id: string;
  requestId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface Approval {
  id: string;
  requestId: string;
  stepId?: string;
  approverId: string;
  approverName: string;
  status: ApprovalStatus;
  notes?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  taskId: string; // e.g. TSK-201
  requestId: string; // e.g. REQ-1001
  requestTitle?: string;
  organizationId: string;
  departmentId: string;
  title: string;
  description: string;
  taskType: string;
  assigneeId: string;
  assigneeName: string;
  createdById: string;
  createdByName: string;
  status: TaskStatus;
  dueDate?: string;
  completedAt?: string;
  resultNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestItem {
  id: string;
  requestId: string; // e.g. REQ-1042
  organizationId: string;
  requesterId: string;
  requesterName?: string;
  departmentId: string;
  departmentName?: string;
  requestTypeId?: string;
  requestTypeName?: string;
  currentStepId?: string;
  currentStepName?: string;
  workflowTemplateId?: string;
  assigneeId?: string;
  assigneeName?: string;
  title: string;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  approvalPolicy?: ApprovalPolicy;
  waitingOn?: string;
  waitingSince?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
  comments: Comment[];
  approvals: Approval[];
  tasks: TaskItem[];
  attachments?: AttachmentItem[];
}

export interface AttachmentItem {
  id: string;
  requestId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  message: string;
  type: 'REQUEST' | 'TASK' | 'APPROVAL' | 'SYSTEM';
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole | string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: any;
  timestamp: string;
}

export interface AuthSession {
  user: User;
  token: string;
}
