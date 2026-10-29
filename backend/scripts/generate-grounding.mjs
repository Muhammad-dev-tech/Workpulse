import fs from 'fs';
import path from 'path';

const rootDir = path.resolve('..');
const desktopDir = 'c:\\Users\\MUHAMMAD\\Desktop';

const filesToInclude = [
  { path: 'backend/package.json', label: 'Backend Dependencies and Scripts' },
  { path: 'frontend/package.json', label: 'Frontend Dependencies and Scripts' },
  { path: 'backend/src/types/index.ts', label: 'Domain Entities, Enums and TypeScript Interfaces' },
  { path: 'backend/src/config/terminology.ts', label: 'Multi-Tenant Dynamic Terminology Engine' },
  { path: 'backend/src/ai/pulseAi.ts', label: 'Pulse AI Gemini 2.5 Flash Integration, Tools & RAG Engine' },
  { path: 'backend/src/repositories/interfaces.ts', label: 'Repository Contract Interfaces' },
  { path: 'backend/src/repositories/supabaseStore.ts', label: 'Supabase PostgreSQL Data Access & Query Engine' },
  { path: 'backend/src/routes/requestRoutes.ts', label: 'Multi-Tier Request Lifecycle & Approval State Machine' },
  { path: 'backend/src/routes/taskRoutes.ts', label: 'Operational Task Engine & Role Boundary Isolation' },
  { path: 'backend/src/routes/authRoutes.ts', label: 'Authentication, Bcrypt Hashing, JWT & RBAC Engine' },
  { path: 'backend/src/routes/departmentRoutes.ts', label: 'Department Configuration & Request Type Routing' },
  { path: 'backend/src/routes/aiRoutes.ts', label: 'Pulse AI Copilot & Query Endpoints' },
  { path: 'backend/src/routes/workflowRoutes.ts', label: 'Workflow Engine & Multi-Tier Definitions' },
  { path: 'frontend/src/App.tsx', label: 'Frontend Application Shell & Role-Based Navigation Routing' },
  { path: 'frontend/src/services/api.ts', label: 'Frontend REST API Client Service Layer' },
  { path: 'frontend/src/components/ai/PulseAiDrawer.tsx', label: 'Pulse AI Copilot Drawer & Dynamic Role-Based FAQs' },
  { path: 'frontend/src/components/radar/PendingRadar.tsx', label: 'Operational Radar & Institutional Bottleneck Detection' },
  { path: 'frontend/src/components/requests/RequestDetailModal.tsx', label: 'Multi-Tier Approval Checkpoints & Operational Workflows' },
  { path: 'frontend/src/components/requests/WhyIsThisStuckModal.tsx', label: 'AI Diagnosis: Why Is This Request Stuck? (Bottleneck Resolver)' },
  { path: 'frontend/src/components/tasks/TaskListView.tsx', label: 'Operational Task Board & Technician Execution View' },
  { path: 'frontend/src/components/tasks/AssignTaskModal.tsx', label: 'Unit Head Task Assignment & Staff Dispatching' },
  { path: 'frontend/src/components/layout/Sidebar.tsx', label: 'Sidebar Navigation & Role-Based Tab Guarding' },
  { path: 'frontend/src/components/layout/Navbar.tsx', label: 'Navbar, Live Search & Persona Switcher' }
];

let output = `# WORKPULSE: FULL TECHNICAL SPECIFICATION & SOURCE GROUNDING DOSSIER
**System Title:** WorkPulse — Enterprise Multi-Tenant Workflow Orchestration, Governance & Operational Visibility Platform
**Artificial Intelligence Engine:** Google Gemini 2.5 Flash with Autonomous Tool Execution & Dynamic Grounding
**Architecture:** Three-Tier Decoupled Client-Server-Database Architecture with Asynchronous AI Copilot
**Target Deployment Environments:** University, Corporate Enterprise, Hospital / Health Network, School / Academy, Government Agency, Non-Governmental Organization (NGO)
**Date of Dossier:** October 2026

---

## 1. EXECUTIVE SYSTEM ARCHITECTURE SUMMARY

### 1.1 The Operational Problem Solved
Traditional workflow tools (such as Jira, ServiceNow, or Zendesk) are either overly complex IT service management frameworks or flat ticketing queues. In multi-tier institutions—such as universities, enterprise corporations, and healthcare networks—a severe disconnect exists between:
1. **Tier 3 Governance (Executives: Vice-Chancellors, CEOs, Directors-General):** Require high-level bottleneck radar, SLA metrics, and policy sign-offs without being flooded by routine operational tickets.
2. **Tier 2 Faculty / Divisional Leadership (Deans, Division Directors):** Act as intermediary governance bridges for high-cost or cross-department requisitions.
3. **Tier 1 Unit Leadership (Heads of Department, Unit Managers):** Assign operational work, triage incoming departmental requisitions, and review staff workloads.
4. **Tier 0 Operational Staff (Technicians, Operators, Employees):** Execute actionable operational tasks (e.g. IT server repairs, procurement fulfillment) with clear time limits and execution checklists.

WorkPulse eliminates bureaucratic stagnation by establishing:
- **Strict Role Boundaries:** Operational tasks are strictly restricted to operational staff and unit heads. Executives only interface with governance approvals and systemic radar.
- **Dynamic Multi-Tenant Terminology:** Seamlessly adapts labels and role titles across 6 institutional paradigms without code changes.
- **Autonomous Pulse AI Copilot:** Powered by Google Gemini 2.5 Flash, equipped with live database function calling tools to answer operational questions with real-time institutional data.

---

## 2. DATABASE RELATIONAL SCHEMA TOPOLOGY (SUPABASE POSTGRESQL)

The persistence layer is structured in Supabase PostgreSQL with strict foreign-key integrity:
- **organizations**: Multi-tenant institutional instances (id, name, org_type, created_at).
- **users**: Accounts with hashed passwords, JWT authentication, and RBAC roles (\`SUPER_ADMIN\`, \`ORG_ADMIN\`, \`DEAN\`, \`MANAGER\`, \`EMPLOYEE\`, \`OPERATOR\`).
- **departments**: Organizational units (id, organization_id, name, code, manager_id, responsibilities, task_types).
- **department_request_types**: Routing definitions specifying \`approval_policy\` (\`DIRECT\`, \`MANAGER_ONLY\`, \`MULTI_TIER\`, \`EXTERNAL\`) and \`sla_hours\`.
- **requests**: Requisitions with multi-step status machine (\`SUBMITTED\`, \`PENDING_APPROVAL\`, \`IN_PROGRESS\`, \`BLOCKED\`, \`RESOLVED\`, \`REJECTED\`).
- **approvals**: Multi-tier sign-off checkpoints (step_number, required_role, status, approver_name, comment, decided_at).
- **tasks**: Actionable operational execution units assigned exclusively to technicians/managers (id, request_id, title, assignee_id, status, priority, due_date).
- **timeline_events**: Immutable chronological audit events tracking every transition.
- **comments**: Collaboration trail for requests.
- **audit_logs**: Governance compliance records.
- **notifications**: User alert inbox.

---

## 3. FULL SOURCE CODE & IMPLEMENTATION MODULES

`;

for (const item of filesToInclude) {
  const fullPath = path.resolve(rootDir, item.path);
  if (fs.existsSync(fullPath)) {
    console.log(`Reading: ${item.path}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const ext = path.extname(item.path).replace('.', '');
    const lang = ext === 'ts' || ext === 'tsx' ? 'typescript' : ext === 'json' ? 'json' : ext;

    output += `\n\n---\n\n`;
    output += `### FILE: \`${item.path}\`\n`;
    output += `**Description:** ${item.label}\n\n`;
    output += `\`\`\`${lang}\n`;
    output += content;
    output += `\n\`\`\`\n`;
  } else {
    console.warn(`File not found: ${fullPath}`);
  }
}

// Write to WorkPulse root
const destInProject = path.resolve(rootDir, 'WorkPulse_Source_Grounding.md');
fs.writeFileSync(destInProject, output, 'utf8');
console.log(`✅ Written to project: ${destInProject}`);

// Write directly to user's Desktop
try {
  const destDesktop = path.resolve(desktopDir, 'WorkPulse_Source_Grounding.md');
  fs.writeFileSync(destDesktop, output, 'utf8');
  console.log(`✅ Written to Desktop: ${destDesktop}`);
} catch (err) {
  console.warn(`⚠️ Could not write to desktop directly:`, err.message);
}
