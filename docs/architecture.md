# WorkPulse Architecture & System Specification

## 1. Executive Summary
**WorkPulse** is a multi-tenant internal workflow and operational visibility platform for businesses. It solves the chaos of managing requests and handoffs via spreadsheets, messaging apps, and memory by providing a centralized, auditable request and workflow engine paired with **Pulse AI**—a natural-language operational copilot.

---

## 2. Core System Architecture

```
                    +-----------------------------+
                    |        CLIENT LAYER         |
                    |   React 18 + TypeScript     |
                    | Vite + Tailwind CSS / UI    |
                    +--------------+--------------+
                                   | REST API (JSON / Bearer JWT)
                                   v
+--------------------------------------------------------------------------+
|                            BACKEND SERVER                                |
|                        Node.js + Express + TS                            |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  |                         MIDDLEWARE PIPELINE                        |  |
|  |  • CORS & Helmet Security                                          |  |
|  |  • Tenant Isolation (`requireOrganizationAccess`)                   |  |
|  |  • Authentication (`requireAuthentication` - JWT)                 |  |
|  |  • RBAC Authorization (`requirePermission` / Resource Check)      |  |
|  +---------------------------------+----------------------------------+  |
|                                    |                                     |
|  +---------------------------------v----------------------------------+  |
|  |                         CONTROLLERS & ROUTES                       |  |
|  |  /api/auth          /api/requests        /api/workflows            |  |
|  |  /api/departments   /api/approvals       /api/analytics            |  |
|  |  /api/notifications /api/audit           /api/ai                   |  |
|  +---------------------------------+----------------------------------+  |
|                                    |                                     |
|  +---------------------------------v----------------------------------+  |
|  |                           SERVICES LAYER                           |  |
|  |  • RequestService       • WorkflowEngine     • RbacService         |  |
|  |  • NotificationService  • AnalyticsService   • PulseAiOrchestrator |  |
|  +---------------------------------+----------------------------------+  |
|                                    |                                     |
|  +---------------------------------v----------------------------------+  |
|  |                     REPOSITORY PATTERN (DUAL-MODE)                 |  |
|  |  • Default / Local Mode: Fast in-memory relational store with       |  |
|  |    full persistence and Acme Technologies seed data.                |  |
|  |  • Supabase / Cloud Mode: Activated when DATABASE_URL or           |  |
|  |    SUPABASE_URL is configured in .env.local.                        |  |
|  +---------------------------------+----------------------------------+  |
+------------------------------------+-------------------------------------+
                                     |
                    +----------------v------------+
                    |       DATABASE LAYER        |
                    |     PostgreSQL (Supabase)   |
                    |   RLS + pgvector + Prisma   |
                    +-----------------------------+
```

---

## 3. Pulse AI 🤖 Tool-Calling Architecture

Pulse AI is an authorized operational assistant, **not** a generic LLM with database credentials.

```
       +--------------------+
       |  User asks query   |
       +---------+----------+
                 |
                 v
       +--------------------+
       | Pulse AI Interface |
       +---------+----------+
                 |
                 v
       +--------------------+
       |   AI Orchestrator  |  (Identifies intent: REQUEST_STATUS, STUCK_REASON, etc.)
       +---------+----------+
                 |
                 v
       +--------------------+
       |  Permission Check  |  (Inherits EXACT user permissions & organization ID)
       +---------+----------+
                 |
                 v
       +--------------------+
       | Authorized AI Tool |  (e.g., get_request, get_department_requests)
       +---------+----------+
                 |
                 v
       +--------------------+
       |  Backend Services  |
       +---------+----------+
                 |
                 v
       +--------------------+
       |  Structured Result |  (JSON with explicit source IDs, e.g., REQ-1042)
       +---------+----------+
                 |
                 v
       +--------------------+
       | Natural AI Answer  |  (Ground-truth response with deep-links to requests)
       +--------------------+
```

### Safety & Confirmation Rules:
- **Read tools** (`get_my_requests`, `search_requests`, `why_is_this_stuck`): Execute automatically under caller RBAC.
- **Write/Mutating tools** (`create_request`, `assign_request`, `approve_request`): Return a staged action preview; requires explicit user confirmation before commitment.

---

## 4. Multi-Tenancy & RBAC

Every business entity is strictly isolated by `organizationId`.
- **Super Admin**: Platform administration.
- **Organization Admin**: Manages organization, users, departments, workflows, and settings.
- **Manager**: Department workload management, escalations, and approvals.
- **Employee**: Initiates requests, views permitted work, adds comments.
- **Operator**: Resolves assigned tasks in department queues.

**Security Rule:** Frontend controls visibility. Backend controls authority.
