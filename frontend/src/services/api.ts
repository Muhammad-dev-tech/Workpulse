import { RequestItem, PendingRadarData, UserPersona, Department, Faculty, ApprovalPolicy, TaskItem, AuditLog, NotificationItem, AttachmentItem, UserRole, AdminOrganizationSummary, AdminStats } from '../types';

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

let activeOrgScope: string = localStorage.getItem('workpulse_active_org') || '';

export const setActiveOrgScope = (orgId: string) => {
  activeOrgScope = orgId;
  if (orgId) {
    localStorage.setItem('workpulse_active_org', orgId);
  } else {
    localStorage.removeItem('workpulse_active_org');
  }
};

export const getActiveOrgScope = () => activeOrgScope;

const API_BASE = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');

function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const finalUrl = (url.startsWith('/api') && API_BASE) ? `${API_BASE}${url}` : url;
  return fetch(finalUrl, init);
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      if (res.status === 502 || res.status === 504 || res.status === 503) {
        throw new Error('WorkPulse backend server is starting up or temporarily unreachable. Please retry in a few moments.');
      }
      throw new Error('Server returned HTTP ' + res.status);
    }
    throw new Error('Unexpected non-JSON response from server.');
  }
}

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
  ...(activeOrgScope ? { 'X-Organization-Id': activeOrgScope } : {})
});

export const api = {
  setActiveOrgScope,
  getActiveOrgScope,

  // Personas & Authentication
  async getPersonas(): Promise<UserPersona[]> {
    const res = await apiFetch('/api/auth/personas', { headers: getHeaders() });
    const json = await safeJson(res);
    return json.data || [];
  },

  // Organization Members & Roles
  async getMembers(): Promise<UserPersona[]> {
    const res = await apiFetch('/api/members', { headers: getHeaders() });
    const json = await safeJson(res);
    return json.data || [];
  },

  async updateMemberRole(userId: string, role: UserRole, departmentId?: string, faculty?: string): Promise<{ success: boolean; data: UserPersona; message?: string }> {
    const res = await apiFetch(`/api/members/${userId}/role`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ role, departmentId, faculty })
    });
    const json = await safeJson(res);
    if (json.success) {
      return json;
    }
    throw new Error(json.error?.message || 'Failed to appoint role');
  },

  async login(email: string, password?: string): Promise<{ user: UserPersona; token: string }> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...(password ? { password } : {}) })
    });
    const json = await safeJson(res);
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
    organizationType?: string;
    organizationId?: string;
    role?: UserRole;
    departmentId?: string;
  }): Promise<{ user: UserPersona; token: string }> {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await safeJson(res);
    if (json.success) {
      setAuthToken(json.data.token);
      return json.data;
    }
    throw new Error(json.error?.message || 'Registration failed');
  },

  async updateProfile(payload: {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ user: UserPersona; token?: string }> {
    const res = await apiFetch('/api/auth/profile', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await safeJson(res);
    if (json.success) {
      if (json.data?.token) {
        setAuthToken(json.data.token);
      }
      return json.data;
    }
    throw new Error(json.error?.message || 'Failed to update profile');
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; recoveryCode?: string; email?: string }> {
    const res = await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const json = await safeJson(res);
    if (json.success) {
      return json;
    }
    throw new Error(json.error?.message || 'Password reset request failed');
  },

  async resetPassword(payload: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await safeJson(res);
    if (json.success) {
      return json;
    }
    throw new Error(json.error?.message || 'Password reset failed');
  },

  async getOrganizations(): Promise<Array<{ id: string; name: string; orgType?: string }>> {
    try {
      const res = await apiFetch('/api/auth/organizations');
      const json = await safeJson(res);
      return json.data || [];
    } catch {
      return [];
    }
  },

  async getPublicDepartments(organizationId: string): Promise<Array<{ id: string; name: string; code: string }>> {
    try {
      const res = await apiFetch(`/api/auth/departments?organizationId=${encodeURIComponent(organizationId)}`);
      const json = await safeJson(res);
      return json.data || [];
    } catch {
      return [];
    }
  },

  async getMe(): Promise<UserPersona | null> {
    if (!currentToken) return null;
    try {
      const res = await apiFetch('/api/auth/me', { headers: getHeaders() });
      if (!res.ok) {
        clearAuthToken();
        return null;
      }
      const json = await safeJson(res);
      return json.data || null;
    } catch {
      return null;
    }
  },

  logout(): void {
    clearAuthToken();
  },

  async resetData(options: { wipeDepartments?: boolean } = {}): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch('/api/auth/reset-data', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(options)
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to reset data');
    return json;
  },

  // Operational Radar
  async getRadar(): Promise<PendingRadarData> {
    const res = await apiFetch('/api/requests/radar', { headers: getHeaders() });
    const json = await safeJson(res);
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

    const res = await apiFetch(`/api/requests?${params.toString()}`, { headers: getHeaders() });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to fetch requests');
    return json.data || [];
  },

  async getRequestById(id: string): Promise<RequestItem> {
    const res = await apiFetch(`/api/requests/${id}`, { headers: getHeaders() });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Request not found');
    return json.data;
  },

  async createRequest(payload: {
    title: string;
    description: string;
    priority?: string;
    departmentId: string;
    requestTypeId?: string;
    approvalPolicy?: string;
    dueDate?: string;
  }): Promise<RequestItem> {
    const res = await apiFetch('/api/requests', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to create request');
    return json.data;
  },

  async updateRequest(id: string, updates: Partial<RequestItem>): Promise<RequestItem> {
    const res = await apiFetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to update request');
    return json.data;
  },

  async completeRequest(id: string): Promise<RequestItem> {
    const res = await apiFetch(`/api/requests/${id}/complete`, {
      method: 'POST',
      headers: getHeaders()
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to complete request');
    return json.data;
  },

  async addComment(id: string, content: string): Promise<any> {
    const res = await apiFetch(`/api/requests/${id}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content })
    });
    const json = await safeJson(res);
    return json.data;
  },

  async addAttachment(id: string, attachment: { fileName: string; fileSize: number; fileType: string; fileUrl: string }): Promise<AttachmentItem> {
    const res = await apiFetch(`/api/requests/${id}/attachments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(attachment)
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to attach file');
    return json.data;
  },

  async getAttachments(id: string): Promise<AttachmentItem[]> {
    const res = await apiFetch(`/api/requests/${id}/attachments`, { headers: getHeaders() });
    const json = await safeJson(res);
    return json.data || [];
  },

  async decideApproval(id: string, approvalId: string, decision: 'APPROVED' | 'REJECTED', notes?: string): Promise<any> {
    const res = await apiFetch(`/api/requests/${id}/approvals/${approvalId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ decision, notes })
    });
    const json = await safeJson(res);
    return json.data;
  },

  // Tasks
  async getTasks(filters: { departmentId?: string; requestId?: string; status?: string; myOnly?: boolean } = {}): Promise<TaskItem[]> {
    const params = new URLSearchParams();
    if (filters.departmentId) params.append('departmentId', filters.departmentId);
    if (filters.requestId) params.append('requestId', filters.requestId);
    if (filters.status) params.append('status', filters.status);
    if (filters.myOnly) params.append('myOnly', 'true');

    const res = await apiFetch(`/api/tasks?${params.toString()}`, { headers: getHeaders() });
    const json = await safeJson(res);
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
    const res = await apiFetch('/api/tasks', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to create task');
    return json.data;
  },

  async updateTask(id: string, updates: { status?: string; resultNotes?: string }): Promise<TaskItem> {
    const res = await apiFetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to update task');
    return json.data;
  },

  // Faculties & Divisions
  async getFaculties(): Promise<Faculty[]> {
    const res = await apiFetch('/api/departments/faculties', { headers: getHeaders() });
    const json = await safeJson(res);
    return json.data || [];
  },

  async createFaculty(payload: {
    name: string;
    code?: string;
    description?: string;
    deanId?: string;
  }): Promise<Faculty> {
    const res = await apiFetch('/api/departments/faculties', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to create faculty');
    return json.data;
  },

  // Departments (Configuration-Driven)
  async getDepartments(): Promise<Department[]> {
    const res = await apiFetch('/api/departments', { headers: getHeaders() });
    const json = await safeJson(res);
    return json.data || [];
  },

  async createDepartment(payload: {
    name: string;
    code: string;
    description: string;
    faculty?: string;
    approvalPolicy?: ApprovalPolicy;
    requiresApproval?: boolean;
    managerId?: string;
    responsibilities: string[];
    requestTypes: any[];
    taskTypes: string[];
  }): Promise<Department> {
    const res = await apiFetch('/api/departments', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to create department');
    return json.data;
  },

  async assignDepartmentManager(departmentId: string, managerId: string): Promise<Department> {
    const res = await apiFetch(`/api/departments/${departmentId}/assign-manager`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ managerId })
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to assign manager');
    return json.data;
  },

  async reassignDepartmentManager(departmentId: string, managerId?: string | null): Promise<Department> {
    const res = await apiFetch(`/api/departments/${departmentId}/assign-manager`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ managerId: managerId || null })
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to update department manager');
    return json.data;
  },

  async reassignFacultyDean(facultyName: string, deanId?: string | null): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch(`/api/departments/faculties/${encodeURIComponent(facultyName)}/assign-dean`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ deanId: deanId || null })
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to update faculty dean');
    return json;
  },

  // Audit Logs
  async getAuditLogs(filters: { limit?: number; actorId?: string; resourceType?: string } = {}): Promise<AuditLog[]> {
    const params = new URLSearchParams();
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.actorId) params.append('actorId', filters.actorId);
    if (filters.resourceType) params.append('resourceType', filters.resourceType);

    const res = await apiFetch(`/api/audit?${params.toString()}`, { headers: getHeaders() });
    const json = await safeJson(res);
    return json.data || [];
  },

  // Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    const res = await apiFetch('/api/notifications', { headers: getHeaders() });
    const json = await safeJson(res);
    return json.data || [];
  },

  async markNotificationRead(id: string): Promise<boolean> {
    const res = await apiFetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders()
    });
    const json = await safeJson(res);
    return json.success;
  },

  async markAllNotificationsRead(): Promise<boolean> {
    const res = await apiFetch('/api/notifications/read-all', {
      method: 'POST',
      headers: getHeaders()
    });
    const json = await safeJson(res);
    return json.success;
  },

  // Pulse AI Query
  async queryPulseAi(query: string, history: { role: 'user' | 'assistant'; content: string }[] = []): Promise<any> {
    const res = await apiFetch('/api/ai/query', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query, history })
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'AI request failed');
    return json.data;
  },

  async confirmPulseAiAction(action: string, parameters: any): Promise<any> {
    const res = await apiFetch('/api/ai/confirm-action', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action, parameters })
    });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Action execution failed');
    return json.data;
  },

  // Platform Super Admin APIs
  async getAdminOrganizations(): Promise<AdminOrganizationSummary[]> {
    const res = await apiFetch('/api/admin/organizations', { headers: getHeaders() });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to load platform organizations');
    return json.data || [];
  },

  async getAdminStats(): Promise<AdminStats> {
    const res = await apiFetch('/api/admin/stats', { headers: getHeaders() });
    const json = await safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to load platform statistics');
    return json.data;
  }
};
