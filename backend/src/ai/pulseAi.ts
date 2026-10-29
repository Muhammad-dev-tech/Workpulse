import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { User } from '../types';
import {
  requestRepository,
  departmentRepository,
  userRepository,
  taskRepository,
  auditRepository,
  organizationRepository
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
  },
  {
    name: 'get_platform_organizations',
    description: 'Retrieve all registered organizations across the platform, their designated superadmins, and platform metrics. Only accessible to the Platform Super Admin.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
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
        const userDeptName = (allDepts.find(d => d.id === user.departmentId)?.name || 'General').replace(/&/g, 'and');
        const targetDeptName = dept.name.replace(/&/g, 'and');
        return {
          result: null,
          error: `Access Denied: You (${user.role} in ${userDeptName}) do not have authorization to access the ${targetDeptName} department queue. WorkPulse enforces strict department isolation.`
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

    // ─── get_platform_organizations ───────────────────────────
    if (toolName === 'get_platform_organizations') {
      if (user.role !== 'SUPER_ADMIN') {
        return {
          result: null,
          error: 'PERMISSION_DENIED: Access Denied. Only the overall Platform Super Admin can query all organizations.'
        };
      }
      const orgs = await organizationRepository.findAll();
      const orgSummaries = await Promise.all(
        orgs.map(async (o) => {
          const orgUsers = await userRepository.findAll(o.id);
          const admin = orgUsers.find(u => u.role === 'SUPER_ADMIN' || u.role === 'ORG_ADMIN') || orgUsers[0];
          const [depts, reqs] = await Promise.all([
            departmentRepository.findAll(o.id),
            requestRepository.findAll(o.id)
          ]);
          return {
            id: o.id,
            name: o.name,
            orgType: (o as any).orgType || 'COMPANY',
            createdAt: o.createdAt,
            superAdmin: admin ? { name: admin.name, email: admin.email, role: admin.role } : null,
            departmentsCount: depts.length,
            usersCount: orgUsers.length,
            requestsCount: reqs.length
          };
        })
      );
      await auditRepository.logAiAction(organizationId, user.id, toolName, {}, true, 'Retrieved platform organizations overview');
      return { result: orgSummaries };
    }

    // ─── get_organization_overview ────────────────────────────
    if (toolName === 'get_organization_overview') {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'DEAN') {
        return { result: null, error: 'PERMISSION_DENIED: Organization-wide overview requires administrator or division governance privileges.' };
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
      const kqLower = (kq || '').toLowerCase();
      const matches = allDepts.filter(d =>
        kqLower.includes(d.name.toLowerCase()) ||
        kqLower.includes(d.code.toLowerCase()) ||
        (d.code === 'IT' && (kqLower.includes('it ') || kqLower.includes(' it') || kqLower.includes('tech'))) ||
        d.responsibilities.some(r => kqLower.includes(r.toLowerCase()) || r.toLowerCase().includes(kqLower)) ||
        d.requestTypes.some(rt => kqLower.includes(rt.name.toLowerCase()) || rt.name.toLowerCase().includes(kqLower)) ||
        kqLower.includes(d.description.toLowerCase())
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
    let response: PulseAiResponse;

    // ── Gemini path ────────────────────────────────────────────
    if (this.useGemini && this.genai) {
      try {
        response = await this.processWithGemini(user, organizationId, query, conversationHistory);
      } catch (err: any) {
        console.error('  ⚠️ Pulse AI: Gemini call encountered error, falling back to rule engine:', err?.message || err);
        response = await this.processWithKeywords(user, organizationId, query);
      }
    } else {
      // ── Keyword fallback path ─────────────────────────────────
      response = await this.processWithKeywords(user, organizationId, query);
    }

    return {
      ...response,
      answer: this.cleanPlainEnglish(response.answer)
    };
  }

  // Sanitizes text into clean, fluent, plain English without raw ampersands or markdown artifacts
  private cleanPlainEnglish(text: string): string {
    if (!text) return '';
    return text
      // Replace all ampersands (&) with the word "and"
      .replace(/\s*&\s*/g, ' and ')
      // Strip markdown bold and italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
      // Strip markdown headers
      .replace(/^#{1,6}\s+/gm, '')
      // Normalize raw bullet characters
      .replace(/^[•]\s*/gm, '- ')
      // Strip error / robotic emojis
      .replace(/^[❌⛔⚠️🤖]\s*/gm, '')
      // Collapse multiple whitespace
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
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

    const systemInstruction = `You are Pulse AI, the intelligent operational copilot for WorkPulse — an enterprise workflow and request management system.

Your current session context:
- Authenticated User: ${user.name}
- Role: ${user.role}
- Department Scope: ${myDept ? `${myDept.name.replace(/&/g, 'and')} (${myDept.code})` : 'All Departments (Administrator)'}
- Organization ID: ${organizationId}

CRITICAL RULES:
1. Always communicate in clear, natural, grammatically correct plain English sentences and paragraphs.
2. NEVER use ampersand characters ("&"). Always spell out the word "and".
3. Avoid raw markdown asterisks (such as **bold** or *italic*), hashtags, or robotic formatting. Write clean sentences.
4. Always call the appropriate tool to fetch real operational data before answering. Never fabricate data.
5. Respect role-based access control boundaries: if a tool returns a permission error or you are asked about cross-department data without permission, state "Access Denied: You do not have permission to view records for this department..." and clearly explain the department isolation boundary.
6. For mutating actions (assign_request), always ask for explicit user confirmation.
7. Always reference real request IDs and actual names from tool responses.

Context about this organization's departments:
${allDepts.map(d => `- ${d.name.replace(/&/g, 'and')} (${d.code}): ${d.description.replace(/&/g, 'and')}`).join('\n')}`;

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
        model: 'gemini-3.8-flash',
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
          role: 'user' as const,
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
          return { answer: error.startsWith('Access Denied') ? error : `Access Denied: ${error}`, toolResults };
        }

        const r = result;
        const cleanTitle = (r.title || '').replace(/&/g, 'and');
        const cleanDept = (r.departmentName || '').replace(/&/g, 'and');
        const cleanAssignee = (r.assigneeName || '').replace(/&/g, 'and');
        const cleanBlocked = (r.waitingOn || '').replace(/&/g, 'and');
        const cleanStep = (r.currentStepName || '').replace(/&/g, 'and');

        if (r.waitingOn) {
          return {
            answer: `Request ${r.requestId} ("${cleanTitle}") is currently on hold with ${r.priority} priority in the ${cleanDept} department.\n\n` +
              `It is assigned to ${cleanAssignee} and is currently waiting on: ${cleanBlocked}.`,
            toolResults,
            identifiedEntity: { type: 'request', id: r.requestId, title: r.title },
            suggestedActions: [`Nudge assignee ${cleanAssignee}`, `View ${r.requestId} timeline`]
          };
        }

        return {
          answer: `Request ${r.requestId} ("${cleanTitle}") is currently ${r.status.toLowerCase().replace(/_/g, ' ')} within the ${cleanDept} department.\n\n` +
            `It is at the "${cleanStep}" step, assigned to ${cleanAssignee}, with ${r.activeTasksCount} active task(s).`,
          toolResults,
          identifiedEntity: { type: 'request', id: r.requestId, title: r.title }
        };
      }
    }

    // 2. Pending approvals
    if (q.includes('approval') || q.includes('pending sign') || q.includes('approve')) {
      const { result, error } = await this.executeTool('get_pending_approvals', {}, user, organizationId);
      toolResults.push({ tool: 'get_pending_approvals', parameters: {}, result: result || undefined, error: error || undefined });
      if (error) return { answer: error.startsWith('Access Denied') ? error : `Access Denied: ${error}`, toolResults };

      if (!result.approvals || result.approvals.length === 0) {
        return {
          answer: 'There are currently no requests awaiting approval in your queue. All workflows are up to date.',
          toolResults
        };
      }

      const approvalList = result.approvals.slice(0, 5).map((a: any, idx: number) => {
        const title = (a.title || '').replace(/&/g, 'and');
        const dept = (a.departmentName || '').replace(/&/g, 'and');
        return `${idx + 1}. Request ${a.requestId} ("${title}") submitted by ${a.requesterName} for the ${dept} department.`;
      }).join('\n');

      return {
        answer: `There are currently ${result.count} request(s) awaiting approval in your queue:\n\n${approvalList}`,
        toolResults
      };
    }

    // 3. My work summary
    if (q.includes('task') || q.includes('assigned to me') || q.includes('my work') || q.includes('my request') || q.includes('what do i')) {
      const { result, error } = await this.executeTool('get_my_work_summary', {}, user, organizationId);
      toolResults.push({ tool: 'get_my_work_summary', parameters: {}, result: result || undefined, error: error || undefined });
      if (error) return { answer: error.startsWith('Access Denied') ? error : `Access Denied: ${error}`, toolResults };

      const taskSection = result.assignedTasks.length > 0
        ? `You have ${result.assignedTasksCount} active task(s) assigned to you:\n` +
          result.assignedTasks.map((t: any) => `- Task ${t.taskId}: "${(t.title || '').replace(/&/g, 'and')}" (${t.status.toLowerCase().replace(/_/g, ' ')})`).join('\n')
        : 'You currently have no active tasks assigned to you.';

      const requestSection = result.recentRequests.length > 0
        ? `You have submitted ${result.submittedRequestsCount} active request(s):\n` +
          result.recentRequests.map((r: any) => `- Request ${r.requestId}: "${(r.title || '').replace(/&/g, 'and')}" (${r.status.toLowerCase().replace(/_/g, ' ')})`).join('\n')
        : 'You have no active requests submitted.';

      return {
        answer: `Here is your work summary, ${result.name}:\n\n${taskSection}\n\n${requestSection}`,
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
      if (error) {
        return {
          answer: error.startsWith('Access Denied') ? error : `Access Denied: ${error}`,
          toolResults
        };
      }

      const deptName = (result.departmentName || matchedDept.name).replace(/&/g, 'and');
      const manager = (result.managerName || 'Unassigned').replace(/&/g, 'and');
      const activeCount = result.totalActive;
      const waitingCount = result.waitingCount;
      const pendingApprovalCount = result.pendingApprovalCount;
      const overdueCount = result.overdueCount;

      let queueText = '';
      if (result.topRequests && result.topRequests.length > 0) {
        queueText = '\n\nActive requests in this queue:\n' + result.topRequests.map((r: any, idx: number) => {
          const title = (r.title || '').replace(/&/g, 'and');
          const status = (r.status || '').toLowerCase().replace(/_/g, ' ');
          const assignee = (r.assignee || 'Unassigned').replace(/&/g, 'and');
          return `${idx + 1}. Request ${r.requestId} ("${title}") is currently ${status}, assigned to ${assignee}.`;
        }).join('\n');
      } else {
        queueText = '\n\nThe department queue is currently completely clear with no active requests.';
      }

      return {
        answer: `The ${deptName} department currently has ${activeCount} active request(s) in its queue, managed by ${manager}. Among these, ${waitingCount} are waiting on external blockers, ${pendingApprovalCount} are awaiting approval, and ${overdueCount} are overdue.${queueText}`,
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
          answer: result.matchingDepartments.map((d: any) => {
            const name = (d.name || '').replace(/&/g, 'and');
            const desc = (d.description || '').replace(/&/g, 'and');
            const manager = (d.managerName || 'Unassigned').replace(/&/g, 'and');
            const handles = (d.responsibilities || []).map((r: string) => r.replace(/&/g, 'and')).join(', ');
            const reqTypes = (d.requestTypes || []).map((t: string) => t.replace(/&/g, 'and')).join(', ');
            return `The ${name} department (${d.code}) is managed by ${manager}.\n\n` +
              `Overview: ${desc}\n` +
              `Responsibilities: ${handles}\n` +
              `Request Types Handled: ${reqTypes}`;
          }).join('\n\n'),
          toolResults
        };
      }
    }

    // 5.5 Platform Organizations for Super Admin
    if ((q.includes('organizations') || q.includes('all orgs') || q.includes('superadmin') || q.includes('platform org')) && user.role === 'SUPER_ADMIN') {
      const { result, error } = await this.executeTool('get_platform_organizations', {}, user, organizationId);
      toolResults.push({ tool: 'get_platform_organizations', parameters: {}, result: result || undefined, error: error || undefined });
      if (!error && result) {
        const orgList = result.map((o: any, idx: number) => {
          const lead = o.superAdmin ? `${o.superAdmin.name} (${o.superAdmin.email})` : 'Unassigned';
          return `${idx + 1}. **${o.name}** [${o.orgType}]\n   - Superadmin: ${lead}\n   - Stats: ${o.departmentsCount} departments, ${o.usersCount} users, ${o.requestsCount} requests`;
        }).join('\n\n');
        return {
          answer: `Here is the global platform directory of all registered organizations:\n\n${orgList}`,
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
        const deptBreakdown = result.departmentSummary.map((d: any) => {
          const dName = (d.name || '').replace(/&/g, 'and');
          return `- ${dName} (${d.code}): ${d.activeCount} active request(s)`;
        }).join('\n');

        return {
          answer: `Here is the organization operational overview:\n\n` +
            `Across the entire organization, there are currently ${result.totalActiveRequests} active request(s), ` +
            `${result.pendingApprovalCount} pending approval, ${result.waitingCount} waiting on blockers, ` +
            `and ${result.overdueCount} overdue, with ${result.activeTasks} active task(s).\n\n` +
            `Department Breakdown:\n${deptBreakdown}`,
          toolResults
        };
      }
    }

    // 7. Default help message
    const myDept = allDepts.find(d => d.id === user.departmentId);
    const myDeptName = myDept ? myDept.name.replace(/&/g, 'and') : 'all departments';
    return {
      answer: `Hello ${user.name}! I am Pulse AI, your operational visibility copilot for WorkPulse.\n\n` +
        `You are authenticated as a ${user.role.toLowerCase().replace(/_/g, ' ')} with access scoped to ${myDeptName}.\n\n` +
        `Here are examples of operational questions you can ask me:\n` +
        `- "How many IT requests are currently pending?"\n` +
        `- "Why is request REQ-1042 stuck?"\n` +
        `- "What tasks are assigned to me?"\n` +
        `- "Show me pending approvals"\n` +
        `- "What does the IT department handle?"`,
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
