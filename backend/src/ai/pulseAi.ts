import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { User } from '../types';
import {
  requestRepository,
  departmentRepository,
  userRepository,
  taskRepository,
  auditRepository
} from '../repositories';
import { canUserAccessDepartment, canUserAccessRequest } from '../middleware/auth';

export interface ToolExecutionResult {
  tool: string;
  parameters: any;
  result?: any;
  error?: string;
  requiresConfirmation?: boolean;
  stagedAction?: any;
}

export interface PulseAiResponse {
  answer: string;
  toolResults: ToolExecutionResult[];
  identifiedEntity?: {
    type: 'request' | 'department' | 'user' | 'task';
    id: string;
    title?: string;
  };
  suggestedActions?: string[];
  requiresConfirmation?: boolean;
  pendingAction?: {
    tool: string;
    description: string;
    parameters: any;
  };
}

// ─────────────────────────────────────────────────────────────
//  Gemini Function Tool Declarations
// ─────────────────────────────────────────────────────────────
const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'get_request_details',
    description: 'Retrieve full details of a specific request by its ID (e.g., REQ-1042). Use this when the user asks about a specific request, its status, why it is stuck, or who is handling it.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        requestId: {
          type: Type.STRING,
          description: 'The request ID string, e.g. REQ-1042'
        }
      },
      required: ['requestId']
    }
  },
  {
    name: 'get_department_requests',
    description: 'Get the active request queue and workload summary for a department. Use when the user asks how many requests are pending in a department, what the department is working on, or department queue status.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        departmentCode: {
          type: Type.STRING,
          description: 'The department code or name, e.g. IT, HR, Finance, ACADEMIC'
        }
      },
      required: ['departmentCode']
    }
  },
  {
    name: 'get_my_work_summary',
    description: 'Retrieve the authenticated user\'s personal task assignments and submitted requests. Use when the user asks what tasks are assigned to them, what they have pending, or their work summary.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'get_organization_overview',
    description: 'Get a high-level operational overview of the entire organization including all department workloads, pending approvals, and system health. Use for broad organizational status queries.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'get_pending_approvals',
    description: 'List all requests currently pending executive or managerial approval. Use when the user asks about approval queues, what needs sign-off, or pending governance decisions.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'get_department_knowledge',
    description: 'Get information about what a department handles, its responsibilities, request types, and who manages it. Use when the user asks which department handles something, or what a department does.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The topic or function the user is asking about, e.g. "software installation", "expense reimbursement", "academic records"'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'assign_request',
    description: 'Assign a specific request to a user. This is a mutating action that requires user confirmation before execution.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        requestId: {
          type: Type.STRING,
          description: 'The request ID to assign'
        },
        assigneeEmail: {
          type: Type.STRING,
          description: 'Email of the user to assign the request to'
        }
      },
      required: ['requestId', 'assigneeEmail']
    }
  }
];

// ─────────────────────────────────────────────────────────────
//  PulseAiService — Gemini-powered RBAC-enforced copilot
// ─────────────────────────────────────────────────────────────
export class PulseAiService {
  private genai: GoogleGenAI | null = null;
  private useGemini: boolean = false;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.length > 10) {
      this.genai = new GoogleGenAI({ apiKey });
      this.useGemini = true;
      console.log('  🤖 Pulse AI: Gemini function-calling enabled');
    } else {
      console.log('  🤖 Pulse AI: Running in keyword-match fallback mode (set GEMINI_API_KEY to enable real AI)');
    }
  }

  // ───── Tool Executor (RBAC enforced on each tool) ─────────
  private async executeTool(
    toolName: string,
    toolArgs: Record<string, any>,
    user: User,
    organizationId: string
  ): Promise<{ result: any; error?: string; requiresConfirmation?: boolean; pendingAction?: any }> {

    // ─── get_request_details ──────────────────────────────────
    if (toolName === 'get_request_details') {
      const { requestId } = toolArgs;
      const request = await requestRepository.findByRequestId(organizationId, requestId);
      if (!request) {
        return { result: null, error: `Request ${requestId} not found in your organization.` };
      }
      if (!canUserAccessRequest(user, request)) {
        await auditRepository.logAiAction(organizationId, user.id, toolName, toolArgs, false,
          `DENIED: ${user.name} (${user.role}) attempted unauthorized access to ${requestId}`);
        return { result: null, error: `PERMISSION_DENIED: You do not have access to request ${requestId}. It belongs to a different department's private queue.` };
      }
      await auditRepository.logAiAction(organizationId, user.id, toolName, toolArgs, true, `Retrieved ${requestId}`);
      return {
        result: {
          requestId: request.requestId,
          title: request.title,
          status: request.status,
          priority: request.priority,
          departmentName: request.departmentName,
          requesterName: request.requesterName,
          assigneeName: request.assigneeName || 'Unassigned',
          currentStepName: request.currentStepName,
          waitingOn: request.waitingOn || null,
          waitingSince: request.waitingSince || null,
          approvalPolicy: request.approvalPolicy,
          dueDate: request.dueDate || null,
          createdAt: request.createdAt,
          pendingApprovals: request.approvals?.filter(a => a.status === 'PENDING').map(a => ({
            approverName: a.approverName, status: a.status
          })) || [],
          activeTasksCount: request.tasks?.filter(t => t.status !== 'COMPLETED').length || 0,
          recentTimeline: request.timeline?.slice(-3).map(t => ({ title: t.title, actor: t.actorName, when: t.timestamp })) || []
        }
      };
    }

    // ─── get_department_requests ──────────────────────────────
    if (toolName === 'get_department_requests') {
      const { departmentCode } = toolArgs;
      const allDepts = await departmentRepository.findAll(organizationId);
      const dept = allDepts.find(d =>
        d.code.toLowerCase() === departmentCode.toLowerCase() ||
        d.name.toLowerCase().includes(departmentCode.toLowerCase())
      );
      if (!dept) {
        return { result: null, error: `Department "${departmentCode}" not found. Available departments: ${allDepts.map(d => d.code).join(', ')}` };
      }
      if (!canUserAccessDepartment(user, dept.id)) {
        await auditRepository.logAiAction(organizationId, user.id, toolName, toolArgs, false,
          `DENIED: ${user.name} attempted to access ${dept.name} queue`);
        return {
          result: null,
          error: `PERMISSION_DENIED: You (${user.role} in ${allDepts.find(d => d.id === user.departmentId)?.name || 'General'}) do not have authorization to access the ${dept.name} department queue. WorkPulse enforces strict department isolation.`
        };
      }
      const requests = await requestRepository.findAll(organizationId, { departmentId: dept.id });
      const active = requests.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
      const waiting = active.filter(r => r.status === 'WAITING' || !!r.waitingOn);
      const pendingApproval = active.filter(r => r.status === 'PENDING_APPROVAL');
      const overdue = active.filter(r => r.dueDate && new Date(r.dueDate) < new Date());
      await auditRepository.logAiAction(organizationId, user.id, toolName, toolArgs, true,
        `Retrieved ${active.length} requests for ${dept.name}`);
      return {
        result: {
          departmentName: dept.name,
          departmentCode: dept.code,
          managerName: dept.managerName || 'Unassigned',
          totalActive: active.length,
          waitingCount: waiting.length,
          pendingApprovalCount: pendingApproval.length,
          overdueCount: overdue.length,
          topRequests: active.slice(0, 5).map(r => ({
            requestId: r.requestId,
            title: r.title,
            status: r.status,
            priority: r.priority,
            assignee: r.assigneeName || 'Unassigned'
          }))
        }
      };
    }

    // ─── get_my_work_summary ──────────────────────────────────
    if (toolName === 'get_my_work_summary') {
      const [myTasks, myRequests] = await Promise.all([
        taskRepository.findAll(organizationId, { assigneeId: user.id }),
        requestRepository.findAll(organizationId, { requesterId: user.id })
      ]);
      const activeTasks = myTasks.filter(t => t.status !== 'COMPLETED');
      const activeRequests = myRequests.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
      await auditRepository.logAiAction(organizationId, user.id, toolName, {}, true, 'Retrieved personal work summary');
      return {
        result: {
          name: user.name,
          role: user.role,
          assignedTasksCount: activeTasks.length,
          assignedTasks: activeTasks.slice(0, 5).map(t => ({
            taskId: t.taskId, title: t.title, status: t.status, requestId: t.requestId
          })),
          submittedRequestsCount: activeRequests.length,
          recentRequests: activeRequests.slice(0, 3).map(r => ({
            requestId: r.requestId, title: r.title, status: r.status, departmentName: r.departmentName
          }))
        }
      };
    }

    // ─── get_organization_overview ────────────────────────────
    if (toolName === 'get_organization_overview') {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
        return { result: null, error: 'PERMISSION_DENIED: Organization-wide overview requires administrator privileges.' };
      }
      const [allRequests, allDepts, allTasks] = await Promise.all([
        requestRepository.findAll(organizationId),
        departmentRepository.findAll(organizationId),
        taskRepository.findAll(organizationId)
      ]);
      const active = allRequests.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
      const pendingApproval = active.filter(r => r.status === 'PENDING_APPROVAL');
      const overdue = active.filter(r => r.dueDate && new Date(r.dueDate) < new Date());
      const waiting = active.filter(r => r.status === 'WAITING' || !!r.waitingOn);
      await auditRepository.logAiAction(organizationId, user.id, toolName, {}, true, 'Retrieved org overview');
      return {
        result: {
          totalActiveRequests: active.length,
          pendingApprovalCount: pendingApproval.length,
          overdueCount: overdue.length,
          waitingCount: waiting.length,
          activeTasks: allTasks.filter(t => t.status !== 'COMPLETED').length,
          departmentSummary: allDepts.map(d => ({
            name: d.name, code: d.code,
            activeCount: active.filter(r => r.departmentId === d.id).length
          }))
        }
      };
    }

    // ─── get_pending_approvals ────────────────────────────────
    if (toolName === 'get_pending_approvals') {
      const allRequests = await requestRepository.findAll(organizationId, { status: 'PENDING_APPROVAL' });
      const visible = allRequests.filter(r => canUserAccessRequest(user, r));
      await auditRepository.logAiAction(organizationId, user.id, toolName, {}, true, `Retrieved ${visible.length} pending approvals`);
      return {
        result: {
          count: visible.length,
          approvals: visible.map(r => ({
            requestId: r.requestId,
            title: r.title,
            requesterName: r.requesterName,
            departmentName: r.departmentName,
            approvalPolicy: r.approvalPolicy,
            createdAt: r.createdAt
          }))
        }
      };
    }

    // ─── get_department_knowledge ─────────────────────────────
    if (toolName === 'get_department_knowledge') {
      const { query: kq } = toolArgs;
      const allDepts = await departmentRepository.findAll(organizationId);
      const kqLower = kq.toLowerCase();
      const matches = allDepts.filter(d =>
        d.responsibilities.some(r => r.toLowerCase().includes(kqLower)) ||
        d.requestTypes.some(rt => rt.name.toLowerCase().includes(kqLower)) ||
        d.name.toLowerCase().includes(kqLower) ||
        d.code.toLowerCase().includes(kqLower) ||
        d.description.toLowerCase().includes(kqLower)
      );
      await auditRepository.logAiAction(organizationId, user.id, toolName, toolArgs, true, 'Answered knowledge query');
      return {
        result: {
          query: kq,
          matchingDepartments: matches.map(d => ({
            name: d.name,
            code: d.code,
            description: d.description,
            managerName: d.managerName || 'Unassigned',
            responsibilities: d.responsibilities,
            requestTypes: d.requestTypes.map(rt => rt.name)
          }))
        }
      };
    }

    // ─── assign_request (mutating — requires confirmation) ────
    if (toolName === 'assign_request') {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'MANAGER') {
        return { result: null, error: 'PERMISSION_DENIED: Only managers and administrators can assign requests.' };
      }
      const { requestId, assigneeEmail } = toolArgs;
      const request = await requestRepository.findByRequestId(organizationId, requestId);
      if (!request) return { result: null, error: `Request ${requestId} not found.` };
      if (!canUserAccessRequest(user, request)) {
        return { result: null, error: `PERMISSION_DENIED: You cannot access request ${requestId}.` };
      }
      const allUsers = await userRepository.findAll(organizationId);
      const assignee = allUsers.find(u => u.email.toLowerCase() === assigneeEmail.toLowerCase());
      if (!assignee) return { result: null, error: `User with email ${assigneeEmail} not found.` };

      return {
        result: {
          requestId: request.requestId,
          requestTitle: request.title,
          assigneeName: assignee.name,
          assigneeEmail: assignee.email
        },
        requiresConfirmation: true,
        pendingAction: {
          tool: 'assign_request',
          description: `Assign request ${request.requestId} ("${request.title}") to ${assignee.name}`,
          parameters: { requestId: request.requestId, assigneeId: assignee.id }
        }
      };
    }

    return { result: null, error: `Unknown tool: ${toolName}` };
  }

  // ───── Main Query Handler ──────────────────────────────────
  async processQuery(
    user: User,
    organizationId: string,
    query: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
  ): Promise<PulseAiResponse> {

    // ── Gemini path ────────────────────────────────────────────
    if (this.useGemini && this.genai) {
      return this.processWithGemini(user, organizationId, query, conversationHistory);
    }

    // ── Keyword fallback path ─────────────────────────────────
    return this.processWithKeywords(user, organizationId, query);
  }

  // ───── Gemini Function-Calling Path ───────────────────────
  private async processWithGemini(
    user: User,
    organizationId: string,
    query: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<PulseAiResponse> {
    const allDepts = await departmentRepository.findAll(organizationId);
    const myDept = allDepts.find(d => d.id === user.departmentId);

    const systemInstruction = `You are **Pulse AI**, the intelligent operational copilot for WorkPulse — an enterprise workflow and request management system used across organizations (corporations, universities, hospitals, government agencies).

**Your current session context:**
- Authenticated User: ${user.name}
- Role: ${user.role}
- Department Scope: ${myDept ? `${myDept.name} (${myDept.code})` : 'All Departments (Administrator)'}
- Organization ID: ${organizationId}

**CRITICAL RULES:**
1. You MUST call the appropriate tool to fetch real data before answering. Never fabricate data.
2. Respect RBAC boundaries: if a tool returns PERMISSION_DENIED, explain the restriction respectfully and clearly.
3. For mutating actions (assign_request), always surface the confirmation requirement to the user.
4. Be concise and professional. Use markdown formatting with bullet points.
5. Always reference real request IDs and actual names from tool responses.
6. If a user asks about cross-department data and they don't have permission, explain the security boundary.

**Context about this organization's departments:**
${allDepts.map(d => `- ${d.name} (${d.code}): ${d.description}`).join('\n')}`;

    const models = this.genai!.models;
    const toolResults: ToolExecutionResult[] = [];
    let pendingAction: PulseAiResponse['pendingAction'] | undefined;
    let requiresConfirmation = false;

    // Build conversation history for Gemini
    const contents = [
      ...conversationHistory.map(h => ({
        role: h.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: h.content }]
      })),
      {
        role: 'user' as const,
        parts: [{ text: query }]
      }
    ];

    let finalAnswer = '';

    // Agentic loop: let Gemini call tools, then respond
    let loopContents = [...contents];
    let iterations = 0;

    while (iterations < 5) {
      iterations++;

      const response = await models.generateContent({
        model: 'gemini-2.0-flash',
        contents: loopContents,
        config: {
          systemInstruction,
          temperature: 0.3,
          maxOutputTokens: 2048,
          tools: [{ functionDeclarations: toolDeclarations }]
        }
      });

      const candidate = response.candidates?.[0];
      if (!candidate) break;

      const parts = candidate.content?.parts || [];
      const functionCalls = parts.filter(p => p.functionCall);
      const textParts = parts.filter(p => p.text);

      if (textParts.length > 0 && functionCalls.length === 0) {
        // Gemini has finished reasoning — extract final text response
        finalAnswer = textParts.map(p => p.text || '').join('\n').trim();
        break;
      }

      if (functionCalls.length === 0) {
        finalAnswer = textParts.map(p => p.text || '').join('\n').trim() || 'I was unable to process your request.';
        break;
      }

      // Execute tool calls
      const functionResults: any[] = [];
      for (const part of functionCalls) {
        const fc = part.functionCall!;
        const toolName = fc.name!;
        const toolArgs = (fc.args as Record<string, any>) || {};

        const { result, error, requiresConfirmation: needsConfirm, pendingAction: staged } = await this.executeTool(
          toolName, toolArgs, user, organizationId
        );

        toolResults.push({
          tool: toolName,
          parameters: toolArgs,
          result: result || undefined,
          error: error || undefined
        });

        if (needsConfirm && staged) {
          requiresConfirmation = true;
          pendingAction = staged;
        }

        functionResults.push({
          role: 'tool' as const,
          parts: [{
            functionResponse: {
              name: toolName,
              response: error ? { error } : { result }
            }
          }]
        });
      }

      // Append model's tool call turn + function responses to conversation
      loopContents = [
        ...loopContents,
        { role: 'model' as const, parts },
        ...functionResults
      ];
    }

    if (!finalAnswer) {
      finalAnswer = 'I was unable to complete your request. Please try rephrasing your question.';
    }

    return {
      answer: finalAnswer,
      toolResults,
      requiresConfirmation,
      pendingAction,
      suggestedActions: this.getSuggestedActions(user, query)
    };
  }

  // ───── Keyword Fallback Path (no Gemini API key) ──────────
  private async processWithKeywords(
    user: User,
    organizationId: string,
    query: string
  ): Promise<PulseAiResponse> {
    const q = query.trim().toLowerCase();
    const toolResults: ToolExecutionResult[] = [];

    // 1. Specific request query: REQ-XXXX
    const reqIdMatch = query.match(/req-(\d+)/i);
    const stuckKeywords = q.includes('stuck') || q.includes('delayed') || q.includes('blocked') || q.includes('waiting');

    if (reqIdMatch || (stuckKeywords && !q.includes('department'))) {
      const targetReqId = reqIdMatch ? reqIdMatch[0].toUpperCase() : null;
      if (targetReqId) {
        const { result, error } = await this.executeTool('get_request_details', { requestId: targetReqId }, user, organizationId);
        toolResults.push({ tool: 'get_request_details', parameters: { requestId: targetReqId }, result: result || undefined, error: error || undefined });

        if (error) {
          return { answer: `❌ ${error}`, toolResults };
        }

        const r = result;
        if (r.waitingOn) {
          return {
            answer: `**${r.requestId}** ("${r.title}") is currently **WAITING**.\n\n` +
              `• **Blocked By:** *${r.waitingOn}*\n` +
              `• **Department:** ${r.departmentName}\n` +
              `• **Assigned To:** ${r.assigneeName}\n` +
              `• **Priority:** ${r.priority}`,
            toolResults,
            identifiedEntity: { type: 'request', id: r.requestId, title: r.title },
            suggestedActions: [`Nudge assignee ${r.assigneeName}`, `View ${r.requestId} timeline`]
          };
        }

        return {
          answer: `**${r.requestId}** ("${r.title}") — Status: **${r.status}**\n\n` +
            `• **Department:** ${r.departmentName}\n` +
            `• **Step:** ${r.currentStepName}\n` +
            `• **Assigned To:** ${r.assigneeName}\n` +
            `• **Active Tasks:** ${r.activeTasksCount}`,
          toolResults,
          identifiedEntity: { type: 'request', id: r.requestId, title: r.title }
        };
      }
    }

    // 2. Pending approvals
    if (q.includes('approval') || q.includes('pending sign') || q.includes('approve')) {
      const { result, error } = await this.executeTool('get_pending_approvals', {}, user, organizationId);
      toolResults.push({ tool: 'get_pending_approvals', parameters: {}, result: result || undefined, error: error || undefined });
      if (error) return { answer: `❌ ${error}`, toolResults };
      return {
        answer: `**${result.count}** request(s) are currently awaiting approval:\n\n` +
          (result.approvals.slice(0, 5).map((a: any) =>
            `• **${a.requestId}**: ${a.title} — *${a.requesterName}* → ${a.departmentName}`
          ).join('\n') || '• No pending approvals.'),
        toolResults
      };
    }

    // 3. My work summary
    if (q.includes('task') || q.includes('assigned to me') || q.includes('my work') || q.includes('my request') || q.includes('what do i')) {
      const { result, error } = await this.executeTool('get_my_work_summary', {}, user, organizationId);
      toolResults.push({ tool: 'get_my_work_summary', parameters: {}, result: result || undefined, error: error || undefined });
      if (error) return { answer: `❌ ${error}`, toolResults };
      return {
        answer: `**Your Work Summary, ${result.name}:**\n\n` +
          `### 📋 Assigned Tasks (${result.assignedTasksCount})\n` +
          (result.assignedTasks.length > 0
            ? result.assignedTasks.map((t: any) => `• **${t.taskId}**: ${t.title} [${t.status}]`).join('\n')
            : '• No active tasks.') +
          `\n\n### 📨 Your Requests (${result.submittedRequestsCount})\n` +
          (result.recentRequests.length > 0
            ? result.recentRequests.map((r: any) => `• **${r.requestId}**: ${r.title} — *${r.status}*`).join('\n')
            : '• No active requests.'),
        toolResults
      };
    }

    // 4. Department query
    const allDepts = await departmentRepository.findAll(organizationId);
    const matchedDept = allDepts.find(d =>
      q.includes(d.name.toLowerCase()) ||
      q.includes(d.code.toLowerCase()) ||
      (d.code === 'IT' && (q.includes('it ') || q.includes(' it') || q.includes('tech')))
    );

    if (matchedDept && (q.includes('how many') || q.includes('pending') || q.includes('working') || q.includes('status') || q.includes('requests') || q.includes('show') || q.includes('queue'))) {
      const { result, error } = await this.executeTool('get_department_requests', { departmentCode: matchedDept.code }, user, organizationId);
      toolResults.push({ tool: 'get_department_requests', parameters: { departmentCode: matchedDept.code }, result: result || undefined, error: error || undefined });
      if (error) return { answer: `⛔ ${error}`, toolResults };
      return {
        answer: `**${result.departmentName} Department Queue:**\n\n` +
          `• **Active Requests:** ${result.totalActive}\n` +
          `• **Waiting / Blocked:** ${result.waitingCount}\n` +
          `• **Pending Approval:** ${result.pendingApprovalCount}\n` +
          `• **Overdue:** ${result.overdueCount}\n` +
          `• **Manager:** ${result.managerName}\n\n` +
          (result.topRequests.length > 0
            ? `**Active Queue:**\n` + result.topRequests.map((r: any) =>
              `• **${r.requestId}**: ${r.title} — *${r.status}* (${r.assignee})`
            ).join('\n')
            : 'Queue is clear.'),
        toolResults,
        identifiedEntity: { type: 'department', id: matchedDept.id, title: matchedDept.name }
      };
    }

    // 5. Department knowledge
    if (q.includes('handle') || q.includes('responsib') || q.includes('who does') || q.includes('which department') || q.includes('where do i')) {
      const { result } = await this.executeTool('get_department_knowledge', { query }, user, organizationId);
      toolResults.push({ tool: 'get_department_knowledge', parameters: { query } });
      if (result?.matchingDepartments?.length > 0) {
        return {
          answer: result.matchingDepartments.map((d: any) =>
            `### 🏢 ${d.name} (${d.code})\n` +
            `• **Overview:** ${d.description}\n` +
            `• **Manager:** ${d.managerName}\n` +
            `• **Handles:** ${d.responsibilities.join(', ')}\n` +
            `• **Request Types:** ${d.requestTypes.join(', ')}`
          ).join('\n\n'),
          toolResults
        };
      }
    }

    // 6. Org overview for admins
    if ((q.includes('overview') || q.includes('organization') || q.includes('all department') || q.includes('system status')) &&
        (user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN')) {
      const { result, error } = await this.executeTool('get_organization_overview', {}, user, organizationId);
      toolResults.push({ tool: 'get_organization_overview', parameters: {}, result: result || undefined, error: error || undefined });
      if (!error && result) {
        return {
          answer: `**Organization Operational Overview:**\n\n` +
            `• **Total Active Requests:** ${result.totalActiveRequests}\n` +
            `• **Pending Approvals:** ${result.pendingApprovalCount}\n` +
            `• **Overdue:** ${result.overdueCount}\n` +
            `• **Waiting on Blockers:** ${result.waitingCount}\n` +
            `• **Active Tasks:** ${result.activeTasks}\n\n` +
            `**By Department:**\n` +
            result.departmentSummary.map((d: any) => `• **${d.name} (${d.code}):** ${d.activeCount} active`).join('\n'),
          toolResults
        };
      }
    }

    // 7. Default help message
    const myDept = allDepts.find(d => d.id === user.departmentId);
    return {
      answer: `Hello **${user.name}**! I am **Pulse AI**, your WorkPulse operational copilot.\n\n` +
        `**Your Scope:** ${user.role} ${myDept ? `— ${myDept.name}` : '(All Departments)'}\n\n` +
        `**You can ask me:**\n` +
        `• *"How many IT requests are pending?"*\n` +
        `• *"Why is REQ-1042 stuck?"*\n` +
        `• *"What tasks are assigned to me?"*\n` +
        `• *"Show me pending approvals"*\n` +
        `• *"Which department handles software installation?"*\n` +
        `• *"Give me the organization overview"* (Admin only)`,
      toolResults: [{ tool: 'get_ai_status', parameters: { userRole: user.role } }]
    };
  }

  private getSuggestedActions(user: User, query: string): string[] {
    const q = query.toLowerCase();
    if (q.includes('approval')) return ['Show me all pending requests', 'Organization overview'];
    if (q.includes('stuck') || q.includes('waiting')) return ['Check department workload', 'Show pending approvals'];
    if (q.includes('task')) return ['Show my requests', 'Department queue status'];
    return ['Show pending approvals', 'What tasks are assigned to me?', 'Department overview'];
  }

  // ───── Confirmed Mutating Actions ─────────────────────────
  async executeConfirmedAction(
    user: User,
    organizationId: string,
    action: string,
    parameters: any
  ): Promise<{ success: boolean; message: string; data?: any }> {
    if (action === 'assign_request') {
      const req = await requestRepository.findByRequestId(organizationId, parameters.requestId);
      if (!req) throw new Error('Request not found');

      const targetUser = await userRepository.findById(parameters.assigneeId);
      if (!targetUser) throw new Error('Assignee user not found');

      await requestRepository.update(organizationId, req.id, {
        assigneeId: targetUser.id,
        assigneeName: targetUser.name
      });

      await requestRepository.addTimelineEvent(organizationId, req.requestId, {
        actorId: user.id,
        actorName: user.name,
        eventType: 'ASSIGNED',
        title: 'Assigned via Pulse AI',
        details: `Assigned to ${targetUser.name} upon user confirmation.`
      });

      await auditRepository.logAiAction(
        organizationId, user.id, 'assign_request', parameters, true,
        `Assigned ${req.requestId} to ${targetUser.name}`
      );

      return {
        success: true,
        message: `Successfully assigned **${req.requestId}** to **${targetUser.name}**.`,
        data: { requestId: req.requestId, assignee: targetUser.name }
      };
    }

    throw new Error(`Unsupported AI action: ${action}`);
  }
}

export const pulseAiService = new PulseAiService();
