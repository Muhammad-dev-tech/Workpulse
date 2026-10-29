export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEAN' | 'MANAGER' | 'EMPLOYEE' | 'OPERATOR';

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string;
  departmentName?: string;
  departmentCode?: string;
  faculty?: string;
  avatarUrl?: string;
  organizationId?: string;
  organizationName?: string;
  organizationType?: string;
  createdAt?: string;
}

export type ApprovalPolicy = 'DIRECT' | 'DEPT_MANAGER' | 'DEAN' | 'EXECUTIVE_ONLY' | 'MULTI_TIER_CHAIN';

export interface Faculty {
  id?: string;
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  deanId?: string;
  deanName?: string;
  departmentCount?: number;
  departments?: { id: string; name: string; code: string; approvalPolicy?: ApprovalPolicy; managerName?: string }[];
  createdAt?: string;
}

export interface DepartmentRequestType {
  id: string;
  name: string;
  description?: string;
  defaultPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  defaultWorkflowId?: string;
  approvalPolicy?: ApprovalPolicy;
  requiresApproval?: boolean;
}

export interface Department {
  id: string;
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
  customId?: string;
  organizationId: string;
  requesterId: string;
  requesterName?: string;
  departmentId: string;
  departmentName?: string;
  faculty?: string;
  requestTypeId?: string;
  requestTypeName?: string;
  currentStepId?: string;
  currentStepName?: string;
  stepId?: string;
  workflowTemplateId?: string;
  assigneeId?: string;
  assigneeName?: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'DRAFT' | 'SUBMITTED' | 'ACTIVE' | 'WAITING' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
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

export interface AdminOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  orgType: string;
  plan: string;
  createdAt: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl?: string;
    createdAt?: string;
  } | null;
  stats: {
    usersCount: number;
    departmentsCount: number;
    requestsCount: number;
    activeRequestsCount: number;
    waitingRequestsCount: number;
    completedRequestsCount: number;
    tasksCount: number;
  };
}

export interface AdminStats {
  totalOrganizations: number;
  totalUsers: number;
  totalDepartments: number;
  totalRequests: number;
  totalActive: number;
  totalWaiting: number;
  totalCompleted: number;
  platformSuperAdmin?: {
    name: string;
    email: string;
    role: string;
  };
}
