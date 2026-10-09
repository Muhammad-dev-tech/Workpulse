import { RequestItem, PendingRadarData, UserPersona, Department, TaskItem, AuditLog, NotificationItem, AttachmentItem } from '../types';

let currentToken: string = localStorage.getItem('workpulse_token') || '';

export const setAuthToken = (token: string) => {
  currentToken = token;
  localStorage.setItem('workpulse_token', token);
};

export const clearAuthToken = () => {
  currentToken = '';
  localStorage.removeItem('workpulse_token');
};

export const getAuthToken = () => currentToken;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {})
});

export const api = {
  // Personas & Authentication
  async getPersonas(): Promise<UserPersona[]> {
    const res = await fetch('/api/auth/personas', { headers: getHeaders() });
    const json = await res.json();
    return json.data || [];
  },

  async login(email: string, password?: string): Promise<{ user: UserPersona; token: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...(password ? { password } : {}) })
    });
    const json = await res.json();
    if (json.success) {
      setAuthToken(json.data.token);
      return json.data;
    }
    throw new Error(json.error?.message || 'Login failed');
  },

  async register(payload: {
    name: string;
    email: string;
    password: string;
    organizationName?: string;
    organizationId?: string;
  }): Promise<{ user: UserPersona; token: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      setAuthToken(json.data.token);
      return json.data;
    }
    throw new Error(json.error?.message || 'Registration failed');
  },

  async getMe(): Promise<UserPersona | null> {
    if (!currentToken) return null;
    try {
      const res = await fetch('/api/auth/me', { headers: getHeaders() });
      if (!res.ok) {
        clearAuthToken();
        return null;
      }
      const json = await res.json();
      return json.data || null;
    } catch {
      return null;
    }
  },

  async getOrganizations(): Promise<Array<{ id: string; name: string; slug: string }>> {
    const res = await fetch('/api/auth/organizations');
    const json = await res.json();
    return json.data || [];
  },

  logout(): void {
    clearAuthToken();
  },

  async resetData(options: { wipeDepartments?: boolean } = {}): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/reset-data', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(options)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to reset data');
    return json;
  },

  // Operational Radar
  async getRadar(): Promise<PendingRadarData> {
    const res = await fetch('/api/requests/radar', { headers: getHeaders() });
    const json = await res.json();
    return json.data;
  },

  // Requests
  async getRequests(filters: { status?: string; departmentId?: string; isOverdue?: boolean; isWaiting?: boolean; myOnly?: boolean } = {}): Promise<RequestItem[]> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.departmentId) params.append('departmentId', filters.departmentId);
    if (filters.isOverdue) params.append('isOverdue', 'true');
    if (filters.isWaiting) params.append('isWaiting', 'true');
    if (filters.myOnly) params.append('myOnly', 'true');

    const res = await fetch(`/api/requests?${params.toString()}`, { headers: getHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to fetch requests');
    return json.data || [];
  },

  async getRequestById(id: string): Promise<RequestItem> {
    const res = await fetch(`/api/requests/${id}`, { headers: getHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Request not found');
    return json.data;
  },

  async createRequest(payload: {
    title: string;
    description: string;
    priority?: string;
    departmentId: string;
    requestTypeId?: string;
    dueDate?: string;
  }): Promise<RequestItem> {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to create request');
    return json.data;
  },

  async updateRequest(id: string, updates: Partial<RequestItem>): Promise<RequestItem> {
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to update request');
    return json.data;
  },

  async completeRequest(id: string): Promise<RequestItem> {
    const res = await fetch(`/api/requests/${id}/complete`, {
      method: 'POST',
      headers: getHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to complete request');
    return json.data;
  },

  async addComment(id: string, content: string): Promise<any> {
    const res = await fetch(`/api/requests/${id}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content })
    });
    const json = await res.json();
    return json.data;
  },

  async addAttachment(id: string, attachment: { fileName: string; fileSize: number; fileType: string; fileUrl: string }): Promise<AttachmentItem> {
    const res = await fetch(`/api/requests/${id}/attachments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(attachment)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to attach file');
    return json.data;
  },

  async getAttachments(id: string): Promise<AttachmentItem[]> {
    const res = await fetch(`/api/requests/${id}/attachments`, { headers: getHeaders() });
    const json = await res.json();
    return json.data || [];
  },

  async decideApproval(id: string, approvalId: string, decision: 'APPROVED' | 'REJECTED', notes?: string): Promise<any> {
    const res = await fetch(`/api/requests/${id}/approvals/${approvalId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ decision, notes })
    });
    const json = await res.json();
    return json.data;
  },

  // Tasks
  async getTasks(filters: { departmentId?: string; requestId?: string; status?: string; myOnly?: boolean } = {}): Promise<TaskItem[]> {
    const params = new URLSearchParams();
    if (filters.departmentId) params.append('departmentId', filters.departmentId);
    if (filters.requestId) params.append('requestId', filters.requestId);
    if (filters.status) params.append('status', filters.status);
    if (filters.myOnly) params.append('myOnly', 'true');

    const res = await fetch(`/api/tasks?${params.toString()}`, { headers: getHeaders() });
    const json = await res.json();
    return json.data || [];
  },

  async createTask(payload: {
    requestId: string;
    title: string;
    description?: string;
    taskType?: string;
    assigneeId: string;
    dueDate?: string;
  }): Promise<TaskItem> {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to create task');
    return json.data;
  },

  async updateTask(id: string, updates: { status?: string; resultNotes?: string }): Promise<TaskItem> {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to update task');
    return json.data;
  },

  // Departments (Configuration-Driven)
  async getDepartments(): Promise<Department[]> {
    const res = await fetch('/api/departments', { headers: getHeaders() });
    const json = await res.json();
    return json.data || [];
  },

  async createDepartment(payload: {
    name: string;
    code: string;
    description: string;
    managerId?: string;
    responsibilities: string[];
    requestTypes: any[];
    taskTypes: string[];
  }): Promise<Department> {
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to create department');
    return json.data;
  },

  async assignDepartmentManager(departmentId: string, managerId: string): Promise<Department> {
    const res = await fetch(`/api/departments/${departmentId}/assign-manager`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ managerId })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to assign manager');
    return json.data;
  },

  // Audit Logs
  async getAuditLogs(filters: { limit?: number; actorId?: string; resourceType?: string } = {}): Promise<AuditLog[]> {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.actorId) params.append('actorId', filters.actorId);
    if (filters.resourceType) params.append('resourceType', filters.resourceType);

    const res = await fetch(`/api/audit?${params.toString()}`, { headers: getHeaders() });
    const json = await res.json();
    return json.data || [];
  },

  // Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    const res = await fetch('/api/notifications', { headers: getHeaders() });
    const json = await res.json();
    return json.data || [];
  },

  async markNotificationRead(id: string): Promise<boolean> {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    const json = await res.json();
    return json.success;
  },

  async markAllNotificationsRead(): Promise<boolean> {
    const res = await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: getHeaders()
    });
    const json = await res.json();
    return json.success;
  },

  // Pulse AI Query
  async queryPulseAi(query: string, history: { role: 'user' | 'assistant'; content: string }[] = []): Promise<any> {
    const res = await fetch('/api/ai/query', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query, history })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'AI request failed');
    return json.data;
  },

  async confirmPulseAiAction(action: string, parameters: any): Promise<any> {
    const res = await fetch('/api/ai/confirm-action', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action, parameters })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Action execution failed');
    return json.data;
  }
};
