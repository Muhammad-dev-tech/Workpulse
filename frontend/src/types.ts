export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'OPERATOR';

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string;
  avatarUrl?: string;
}

export interface DepartmentRequestType {
  id: string;
  name: string;
  description?: string;
  defaultPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  defaultWorkflowId?: string;
  approvalPolicy?: 'DIRECT' | 'DEPT_MANAGER' | 'EXECUTIVE_ONLY' | 'MULTI_TIER_CHAIN';
  requiresApproval?: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  managerId?: string;
  managerName?: string;
  responsibilities: string[];
  requestTypes: DepartmentRequestType[];
  taskTypes: string[];
  employeeIds?: string[];
  createdAt?: string;
}

export interface TimelineEvent {
  id: string;
  requestId: string;
  actorId?: string;
  actorName?: string;
  eventType: string;
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
  decidedAt?: string;
  createdAt: string;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

export interface TaskItem {
  id: string;
  taskId: string;
  requestId: string;
  requestTitle?: string;
  organizationId?: string;
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
  requestId: string;
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
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'DRAFT' | 'SUBMITTED' | 'ACTIVE' | 'WAITING' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
  approvalPolicy?: 'DIRECT' | 'DEPT_MANAGER' | 'EXECUTIVE_ONLY' | 'MULTI_TIER_CHAIN';
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
  organizationId?: string;
  title: string;
  message: string;
  type: 'REQUEST' | 'TASK' | 'APPROVAL' | 'SYSTEM';
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  organizationId?: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: any;
  timestamp: string;
}

export interface PendingRadarData {
  totalActive: number;
  overdueCount: number;
  waitingCount: number;
  pendingApprovalCount: number;
  assignedToMeCount: number;
  createdByMeCount: number;
  completedTodayCount: number;
  departmentWorkload: {
    id: string;
    name: string;
    code: string;
    totalActive: number;
    waiting: number;
  }[];
}

export interface PulseAiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolResults?: {
    tool: string;
    parameters: any;
    result?: any;
    error?: string;
  }[];
  suggestedActions?: string[];
  pendingAction?: {
    tool: string;
    description: string;
    parameters: any;
  };
}
