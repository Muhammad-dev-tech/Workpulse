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

// Initial Organizations
const organizations: Organization[] = [
  {
    id: 'org-acme-1',
    name: 'Acme Technologies Inc.',
    slug: 'acme',
    plan: 'enterprise',
    createdAt: '2026-01-01T00:00:00Z'
  }
];

// Initial Users
let users: User[] = [
  {
    id: 'user-superadmin',
    organizationId: 'org-acme-1',
    email: 'admin@acme.com',
    name: 'System Administrator',
    role: 'SUPER_ADMIN',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&fit=crop',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'user-alex',
    organizationId: 'org-acme-1',
    departmentId: 'dept-it',
    email: 'alex@acme.com',
    name: 'Alex Vance',
    role: 'ORG_ADMIN',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&fit=crop',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'user-muhammad',
    organizationId: 'org-acme-1',
    departmentId: 'dept-it',
    email: 'muhammad@acme.com',
    name: 'Muhammad Tariq',
    role: 'MANAGER',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&fit=crop',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'user-sarah',
    organizationId: 'org-acme-1',
    departmentId: 'dept-fin',
    email: 'sarah@acme.com',
    name: 'Sarah Connor',
    role: 'MANAGER',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&fit=crop',
    createdAt: '2026-01-03T00:00:00Z'
  },
  {
    id: 'user-aisha',
    organizationId: 'org-acme-1',
    departmentId: 'dept-it',
    email: 'aisha@acme.com',
    name: 'Aisha Patel',
    role: 'EMPLOYEE',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=128&fit=crop',
    createdAt: '2026-01-04T00:00:00Z'
  },
  {
    id: 'user-ahmed',
    organizationId: 'org-acme-1',
    departmentId: 'dept-it',
    email: 'ahmed@acme.com',
    name: 'Ahmed Khan',
    role: 'EMPLOYEE',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=128&fit=crop',
    createdAt: '2026-01-04T00:00:00Z'
  },
  {
    id: 'user-ibrahim',
    organizationId: 'org-acme-1',
    departmentId: 'dept-proc',
    email: 'ibrahim@acme.com',
    name: 'Ibrahim Al-Mansoor',
    role: 'EMPLOYEE',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&fit=crop',
    createdAt: '2026-01-02T00:00:00Z'
  },
  {
    id: 'user-elena',
    organizationId: 'org-acme-1',
    departmentId: 'dept-sales',
    email: 'elena@acme.com',
    name: 'Elena Rostova',
    role: 'EMPLOYEE',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&fit=crop',
    createdAt: '2026-01-05T00:00:00Z'
  }
];

// Initial Configurable Departments
let departments: Department[] = [
  {
    id: 'dept-it',
    organizationId: 'org-acme-1',
    name: 'Information Technology',
    code: 'IT',
    description: 'Handles organizational technology, network infrastructure, software provisioning, and technical support.',
    managerId: 'user-muhammad',
    managerName: 'Muhammad Tariq',
    responsibilities: [
      'Technical Support',
      'Software Management',
      'Account Management',
      'System Administration'
    ],
    requestTypes: [
      { id: 'rt-it-1', name: 'Software Installation', description: 'Request software tools and licensed IDEs/utilities.', defaultPriority: 'MEDIUM', defaultWorkflowId: 'wf-it-support', approvalPolicy: 'DIRECT' },
      { id: 'rt-it-2', name: 'Account Access', description: 'Request cloud credentials, VPN, or permission changes.', defaultPriority: 'HIGH', defaultWorkflowId: 'wf-it-support', approvalPolicy: 'EXECUTIVE_ONLY', requiresApproval: true },
      { id: 'rt-it-3', name: 'Technical Support', description: 'Report system bugs, workstation crashes, or network faults.', defaultPriority: 'URGENT', defaultWorkflowId: 'wf-it-support', approvalPolicy: 'DIRECT' },
      { id: 'rt-it-4', name: 'Hardware Setup', description: 'Request monitor, peripheral setup, or docking stations.', defaultPriority: 'LOW', defaultWorkflowId: 'wf-hardware', approvalPolicy: 'DEPT_MANAGER' }
    ],
    taskTypes: [
      'Diagnose issue',
      'Install software',
      'Reset account',
      'Configure workstation',
      'Resolve technical problem'
    ],
    employeeIds: ['user-aisha', 'user-ahmed'],
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'dept-fin',
    organizationId: 'org-acme-1',
    name: 'Finance and Accounting',
    code: 'FIN',
    description: 'Budget allocations, expense reimbursements, purchase order verification, and financial audits.',
    managerId: 'user-sarah',
    managerName: 'Sarah Connor',
    responsibilities: [
      'Budget Approval',
      'Expense Reimbursement',
      'Vendor Invoicing',
      'Financial Auditing'
    ],
    requestTypes: [
      { id: 'rt-fin-1', name: 'Expense Reimbursement', description: 'Submit travel or client-related receipts for reimbursement.', defaultPriority: 'MEDIUM', defaultWorkflowId: 'wf-expense', approvalPolicy: 'DEPT_MANAGER' },
      { id: 'rt-fin-2', name: 'Purchase Order Approval', description: 'Review and approve enterprise software and vendor invoices.', defaultPriority: 'HIGH', defaultWorkflowId: 'wf-expense', approvalPolicy: 'EXECUTIVE_ONLY', requiresApproval: true }
    ],
    taskTypes: [
      'Verify Receipts',
      'Audit Budget Allocation',
      'Process Bank Transfer'
    ],
    employeeIds: ['user-sarah'],
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'dept-proc',
    organizationId: 'org-acme-1',
    name: 'Procurement and Supply Chain',
    code: 'PROC',
    description: 'Vendor relationship management, asset sourcing, hardware quotes, and contract fulfillment.',
    managerId: 'user-ibrahim',
    managerName: 'Ibrahim Al-Mansoor',
    responsibilities: [
      'Vendor Sourcing',
      'Hardware Procurement',
      'Supplier Quotations',
      'Asset Delivery'
    ],
    requestTypes: [
      { id: 'rt-proc-1', name: 'Hardware Replacement', description: 'Sourcing new laptops, servers, or networking components.', defaultPriority: 'HIGH', defaultWorkflowId: 'wf-hardware' },
      { id: 'rt-proc-2', name: 'Vendor Quotation', description: 'Obtaining competitive price bids from suppliers.', defaultPriority: 'MEDIUM', defaultWorkflowId: 'wf-hardware' }
    ],
    taskTypes: [
      'Contact Vendor',
      'Compare Quotations',
      'Issue Purchase Order',
      'Track Shipment'
    ],
    employeeIds: ['user-ibrahim'],
    createdAt: '2026-01-01T00:00:00Z'
  }
];

// Workflow Templates
let workflows: WorkflowTemplate[] = [
  {
    id: 'wf-it-support',
    organizationId: 'org-acme-1',
    name: 'IT Technical Support and Provisioning',
    description: 'Employee submits request -> IT Manager reviews -> Task assigned to technician -> Technician works -> Manager verifies -> Request completed.',
    departmentId: 'dept-it',
    createdAt: '2026-01-01T00:00:00Z',
    steps: [
      { id: 'step-it-1', templateId: 'wf-it-support', stepOrder: 1, name: 'Employee Submission', slaHours: 2 },
      { id: 'step-it-2', templateId: 'wf-it-support', stepOrder: 2, name: 'IT Manager Review and Task Assignment', departmentId: 'dept-it', requiredRole: 'MANAGER', slaHours: 12 },
      { id: 'step-it-3', templateId: 'wf-it-support', stepOrder: 3, name: 'Technician Work and Resolution', departmentId: 'dept-it', requiredRole: 'EMPLOYEE', slaHours: 24 },
      { id: 'step-it-4', templateId: 'wf-it-support', stepOrder: 4, name: 'Manager Final Verification', departmentId: 'dept-it', requiredRole: 'MANAGER', requiresApproval: true, slaHours: 12 }
    ]
  },
  {
    id: 'wf-hardware',
    organizationId: 'org-acme-1',
    name: 'Hardware Procurement and Replacement',
    description: 'Multi-stage workflow for device replacement, quotation, finance authorization, and delivery.',
    departmentId: 'dept-proc',
    createdAt: '2026-01-01T00:00:00Z',
    steps: [
      { id: 'step-hw-1', templateId: 'wf-hardware', stepOrder: 1, name: 'Manager Approval', requiredRole: 'MANAGER', requiresApproval: true, slaHours: 24 },
      { id: 'step-hw-2', templateId: 'wf-hardware', stepOrder: 2, name: 'IT Technical Assessment', departmentId: 'dept-it', slaHours: 12 },
      { id: 'step-hw-3', templateId: 'wf-hardware', stepOrder: 3, name: 'Procurement and Quotation', departmentId: 'dept-proc', slaHours: 48 },
      { id: 'step-hw-4', templateId: 'wf-hardware', stepOrder: 4, name: 'Finance PO Approval', departmentId: 'dept-fin', requiredRole: 'MANAGER', requiresApproval: true, slaHours: 24 },
      { id: 'step-hw-5', templateId: 'wf-hardware', stepOrder: 5, name: 'Vendor Delivery and Setup', departmentId: 'dept-it', slaHours: 48 }
    ]
  },
  {
    id: 'wf-expense',
    organizationId: 'org-acme-1',
    name: 'Expense Reimbursement and Invoice Approval',
    description: 'Employee submit receipts -> Manager check -> Finance approval -> Wire transfer.',
    departmentId: 'dept-fin',
    createdAt: '2026-01-01T00:00:00Z',
    steps: [
      { id: 'step-ex-1', templateId: 'wf-expense', stepOrder: 1, name: 'Receipt Submission', slaHours: 24 },
      { id: 'step-ex-2', templateId: 'wf-expense', stepOrder: 2, name: 'Department Review', requiredRole: 'MANAGER', requiresApproval: true, slaHours: 48 },
      { id: 'step-ex-3', templateId: 'wf-expense', stepOrder: 3, name: 'Finance Audit and Wire Transfer', departmentId: 'dept-fin', requiredRole: 'MANAGER', slaHours: 72 }
    ]
  }
];

// Initial Tasks
let tasks: TaskItem[] = [
  {
    id: 'task-uuid-201',
    taskId: 'TSK-201',
    requestId: 'REQ-1001',
    requestTitle: 'Software Installation - JetBrains and Docker Suite',
    organizationId: 'org-acme-1',
    departmentId: 'dept-it',
    title: 'Install and configure Docker Engine and IntelliJ License',
    description: 'Provision Enterprise JetBrains license key and configure Docker Desktop daemon with proxy settings.',
    taskType: 'Install software',
    assigneeId: 'user-ahmed',
    assigneeName: 'Ahmed Khan',
    createdById: 'user-muhammad',
    createdByName: 'Muhammad Tariq',
    status: 'IN_PROGRESS',
    dueDate: '2026-10-04T18:00:00Z',
    createdAt: '2026-10-01T10:30:00Z',
    updatedAt: '2026-10-01T11:00:00Z'
  },
  {
    id: 'task-uuid-202',
    taskId: 'TSK-202',
    requestId: 'REQ-1002',
    requestTitle: 'Account Access - AWS Production Read-Only',
    organizationId: 'org-acme-1',
    departmentId: 'dept-it',
    title: 'Verify AWS IAM Policy and Generate Read-Only Token',
    description: 'Audit requester credentials and attach ReadOnlyAccess policy in AWS IAM Identity Center.',
    taskType: 'Reset account',
    assigneeId: 'user-aisha',
    assigneeName: 'Aisha Patel',
    createdById: 'user-muhammad',
    createdByName: 'Muhammad Tariq',
    status: 'TODO',
    dueDate: '2026-10-03T16:00:00Z',
    createdAt: '2026-10-01T14:15:00Z',
    updatedAt: '2026-10-01T14:15:00Z'
  }
];

// Initial Requests
let requests: RequestItem[] = [
  {
    id: 'req-uuid-1001',
    requestId: 'REQ-1001',
    organizationId: 'org-acme-1',
    requesterId: 'user-aisha',
    requesterName: 'Aisha Patel',
    departmentId: 'dept-it',
    departmentName: 'Information Technology',
    requestTypeId: 'rt-it-1',
    requestTypeName: 'Software Installation',
    currentStepId: 'step-it-3',
    currentStepName: 'Technician Work and Resolution',
    workflowTemplateId: 'wf-it-support',
    assigneeId: 'user-ahmed',
    assigneeName: 'Ahmed Khan',
    title: 'Software Installation - JetBrains and Docker Suite',
    description: 'Requires local container runtime and IntelliJ Ultimate for upcoming microservices refactoring sprint.',
    priority: 'HIGH',
    status: 'ACTIVE',
    dueDate: '2026-10-05T17:00:00Z',
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-01T11:00:00Z',
    timeline: [
      {
        id: 'tl-1001-1',
        requestId: 'REQ-1001',
        actorId: 'user-aisha',
        actorName: 'Aisha Patel',
        eventType: 'CREATED',
        title: 'Request Submitted',
        details: 'Submitted software installation request for engineering tools.',
        timestamp: '2026-10-01T09:00:00Z'
      },
      {
        id: 'tl-1001-2',
        requestId: 'REQ-1001',
        actorId: 'user-muhammad',
        actorName: 'Muhammad Tariq',
        eventType: 'TASK_ASSIGNED',
        title: 'Task Assigned to Ahmed Khan',
        details: 'Assigned task TSK-201 (Install software) to technician Ahmed Khan.',
        timestamp: '2026-10-01T10:30:00Z'
      }
    ],
    comments: [
      {
        id: 'cmt-1',
        requestId: 'REQ-1001',
        authorId: 'user-ahmed',
        authorName: 'Ahmed Khan',
        authorRole: 'EMPLOYEE',
        content: 'I have verified license server availability. Beginning workstation setup now.',
        createdAt: '2026-10-01T11:05:00Z'
      }
    ],
    approvals: [],
    tasks: [tasks[0]]
  },
  {
    id: 'req-uuid-1002',
    requestId: 'REQ-1002',
    organizationId: 'org-acme-1',
    requesterId: 'user-ahmed',
    requesterName: 'Ahmed Khan',
    departmentId: 'dept-it',
    departmentName: 'Information Technology',
    requestTypeId: 'rt-it-2',
    requestTypeName: 'Account Access',
    currentStepId: 'step-it-2',
    currentStepName: 'IT Manager Review & Task Assignment',
    workflowTemplateId: 'wf-it-support',
    assigneeId: 'user-muhammad',
    assigneeName: 'Muhammad Tariq',
    title: 'Account Access - AWS Production Read-Only',
    description: 'Requires Read-Only CloudWatch & ECS console access to debug latency spikes in the production payment pipeline.',
    priority: 'HIGH',
    status: 'SUBMITTED',
    dueDate: '2026-10-03T16:00:00Z',
    createdAt: '2026-10-01T14:00:00Z',
    updatedAt: '2026-10-01T14:15:00Z',
    timeline: [
      {
        id: 'tl-1002-1',
        requestId: 'REQ-1002',
        actorId: 'user-ahmed',
        actorName: 'Ahmed Khan',
        eventType: 'CREATED',
        title: 'Request Submitted',
        details: 'Submitted request for production cloud observability access.',
        timestamp: '2026-10-01T14:00:00Z'
      },
      {
        id: 'tl-1002-2',
        requestId: 'REQ-1002',
        actorId: 'user-muhammad',
        actorName: 'Muhammad Tariq',
        eventType: 'TASK_ASSIGNED',
        title: 'Task Assigned to Aisha Patel',
        details: 'Assigned task TSK-202 (Verify IAM policy) to Aisha Patel.',
        timestamp: '2026-10-01T14:15:00Z'
      }
    ],
    comments: [],
    approvals: [],
    tasks: [tasks[1]]
  },
  {
    id: 'req-uuid-1042',
    requestId: 'REQ-1042',
    organizationId: 'org-acme-1',
    requesterId: 'user-muhammad',
    requesterName: 'Muhammad Tariq',
    departmentId: 'dept-proc',
    departmentName: 'Procurement & Supply Chain',
    requestTypeId: 'rt-proc-1',
    requestTypeName: 'Hardware Replacement',
    currentStepId: 'step-hw-3',
    currentStepName: 'Procurement & Quotation',
    workflowTemplateId: 'wf-hardware',
    assigneeId: 'user-ibrahim',
    assigneeName: 'Ibrahim Al-Mansoor',
    title: 'MacBook Pro M3 Replacement for Lead Dev',
    description: 'Current development machine motherboard experiencing kernel panic loops. Replacement urgently required for upcoming release cycle.',
    priority: 'HIGH',
    status: 'WAITING',
    waitingOn: 'Supplier quotation',
    waitingSince: '2026-09-28T14:30:00Z',
    dueDate: '2026-09-30T18:00:00Z',
    createdAt: '2026-09-27T09:00:00Z',
    updatedAt: '2026-09-28T14:30:00Z',
    timeline: [
      {
        id: 'tl-1042-1',
        requestId: 'REQ-1042',
        actorId: 'user-muhammad',
        actorName: 'Muhammad Tariq',
        eventType: 'CREATED',
        title: 'Request Created',
        details: 'Submitted hardware replacement request for lead developer.',
        timestamp: '2026-09-27T09:00:00Z'
      },
      {
        id: 'tl-1042-2',
        requestId: 'REQ-1042',
        actorId: 'user-ibrahim',
        actorName: 'Ibrahim Al-Mansoor',
        eventType: 'WAITING_ON',
        title: 'Marked Waiting on Vendor',
        details: 'Sent RFQ to Apple Premier Partner. Waiting for formal quotation PDF.',
        timestamp: '2026-09-28T14:30:00Z'
      }
    ],
    comments: [
      {
        id: 'cmt-1042-1',
        requestId: 'REQ-1042',
        authorId: 'user-ibrahim',
        authorName: 'Ibrahim Al-Mansoor',
        authorRole: 'EMPLOYEE',
        content: 'Vendor promised revised quotation with corporate educational discount by tomorrow morning.',
        createdAt: '2026-09-28T15:00:00Z'
      }
    ],
    approvals: [],
    tasks: []
  },
  {
    id: 'req-uuid-1088',
    requestId: 'REQ-1088',
    organizationId: 'org-acme-1',
    requesterId: 'user-sarah',
    requesterName: 'Sarah Connor',
    departmentId: 'dept-fin',
    departmentName: 'Finance and Accounting',
    requestTypeId: 'rt-fin-2',
    requestTypeName: 'Purchase Order Approval',
    currentStepId: 'step-ex-3',
    currentStepName: 'Finance Audit and Wire Transfer',
    workflowTemplateId: 'wf-expense',
    assigneeId: 'user-sarah',
    assigneeName: 'Sarah Connor',
    title: 'Quarterly Cloud Infrastructure Expense Reimbursement',
    description: 'Internal financial audit and budget reconciliation for quarterly AWS and GCP enterprise billing.',
    priority: 'HIGH',
    status: 'ACTIVE',
    dueDate: '2026-10-10T18:00:00Z',
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
    timeline: [
      {
        id: 'tl-1088-1',
        requestId: 'REQ-1088',
        actorId: 'user-sarah',
        actorName: 'Sarah Connor',
        eventType: 'CREATED',
        title: 'Finance Internal Reconciliation',
        details: 'Submitted for quarterly ledger reconciliation.',
        timestamp: '2026-10-01T08:00:00Z'
      }
    ],
    comments: [],
    approvals: [],
    tasks: []
  }
];

// Initial Audit Logs
let auditLogs: AuditLog[] = [
  {
    id: 'aud-1',
    organizationId: 'org-acme-1',
    actorId: 'user-superadmin',
    actorName: 'System Administrator',
    actorRole: 'SUPER_ADMIN',
    action: 'ORGANIZATION_INITIALIZED',
    resourceType: 'Organization',
    resourceId: 'org-acme-1',
    details: { name: 'Acme Technologies Inc.', plan: 'Enterprise' },
    timestamp: '2026-01-01T00:00:00Z'
  },
  {
    id: 'aud-2',
    organizationId: 'org-acme-1',
    actorId: 'user-superadmin',
    actorName: 'System Administrator',
    actorRole: 'SUPER_ADMIN',
    action: 'DEPARTMENT_CONFIGURED',
    resourceType: 'Department',
    resourceId: 'dept-it',
    details: {
      name: 'Information Technology',
      code: 'IT',
      responsibilities: ['Technical Support', 'Software Management', 'Account Management']
    },
    timestamp: '2026-01-01T00:05:00Z'
  },
  {
    id: 'aud-3',
    organizationId: 'org-acme-1',
    actorId: 'user-superadmin',
    actorName: 'System Administrator',
    actorRole: 'SUPER_ADMIN',
    action: 'MANAGER_ASSIGNED',
    resourceType: 'User',
    resourceId: 'user-muhammad',
    details: { assignedUser: 'Muhammad Tariq', department: 'dept-it', role: 'MANAGER' },
    timestamp: '2026-01-01T00:10:00Z'
  },
  {
    id: 'aud-4',
    organizationId: 'org-acme-1',
    actorId: 'user-muhammad',
    actorName: 'Muhammad Tariq',
    actorRole: 'MANAGER',
    action: 'TASK_ASSIGNED',
    resourceType: 'Task',
    resourceId: 'TSK-201',
    details: { assignee: 'Ahmed Khan', requestId: 'REQ-1001', taskType: 'Install software' },
    timestamp: '2026-10-01T10:30:00Z'
  }
];

// Initial Notifications
let notifications: NotificationItem[] = [
  {
    id: 'notif-1',
    userId: 'user-muhammad',
    organizationId: 'org-acme-1',
    title: 'New IT Request Submitted',
    message: 'Ahmed Khan submitted "Account Access - AWS Production Read-Only" (REQ-1002).',
    type: 'REQUEST',
    link: 'REQ-1002',
    read: false,
    createdAt: '2026-10-01T14:00:00Z'
  },
  {
    id: 'notif-2',
    userId: 'user-ahmed',
    organizationId: 'org-acme-1',
    title: 'Task Assigned to You',
    message: 'Manager Muhammad Tariq assigned task TSK-201 ("Install and configure Docker Engine") to you.',
    type: 'TASK',
    link: 'REQ-1001',
    read: false,
    createdAt: '2026-10-01T10:30:00Z'
  },
  {
    id: 'notif-3',
    userId: 'user-aisha',
    organizationId: 'org-acme-1',
    title: 'Task Assigned to You',
    message: 'Manager Muhammad Tariq assigned task TSK-202 ("Verify AWS IAM Policy") to you.',
    type: 'TASK',
    link: 'REQ-1002',
    read: false,
    createdAt: '2026-10-01T14:15:00Z'
  }
];

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
    let result = requests.filter(r => r.organizationId === organizationId);
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
    let result = tasks.filter(t => t.organizationId === organizationId);
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
    return JSON.parse(JSON.stringify(departments.filter(d => d.organizationId === organizationId)));
  }

  async findById(organizationId: string, id: string): Promise<Department | null> {
    const dept = departments.find(d => d.organizationId === organizationId && (d.id === id || d.code.toUpperCase() === id.toUpperCase()));
    return dept ? JSON.parse(JSON.stringify(dept)) : null;
  }

  async create(organizationId: string, data: Omit<Department, 'id' | 'createdAt' | 'organizationId'>): Promise<Department> {
    const code = data.code.toUpperCase();
    const id = `dept-${code.toLowerCase()}`;
    const newDept: Department = {
      ...data,
      id,
      code,
      organizationId,
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
      ...data
    };

    return JSON.parse(JSON.stringify(departments[idx]));
  }

  async assignManager(organizationId: string, departmentId: string, managerId: string, managerName: string): Promise<Department | null> {
    const dept = departments.find(d => d.organizationId === organizationId && d.id === departmentId);
    if (!dept) return null;

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
    return JSON.parse(JSON.stringify(users.filter(u => u.organizationId === organizationId)));
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

  async updateRoleAndDepartment(userId: string, role: User['role'], departmentId?: string): Promise<User | null> {
    const user = users.find(u => u.id === userId);
    if (!user) return null;

    user.role = role;
    if (departmentId !== undefined) {
      user.departmentId = departmentId;
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
    let result = auditLogs.filter(a => a.organizationId === organizationId);
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

  async create(data: { name: string; slug?: string }): Promise<Organization> {
    const baseSlug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newOrg: Organization = {
      id: `org-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: data.name,
      slug: `${baseSlug}-${Date.now().toString().slice(-4)}`,
      plan: 'enterprise',
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

