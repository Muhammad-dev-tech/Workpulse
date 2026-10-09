# WorkPulse: Complete User Tutorial & Academic Defense Guide

Welcome to **WorkPulse** — an enterprise-grade, configuration-driven operational visibility and workflow management platform with an authorized **Pulse AI Copilot**.

This guide covers:
1. **System Overview & Design Principles**
2. **How to Run the Application**
3. **Demo Personas & Credentials**
4. **Step-by-Step Interactive Feature Walkthroughs**
5. **How to Run Automated Verification Suites**
6. **Academic & Technical Defense Talking Points**

---

## 1. System Overview & Core Principles

WorkPulse is designed to solve operational opacity and multi-department communication silos in modern organizations and universities without hard-coding business logic into application code.

### Core Architectural Pillars
- **Configuration-Driven**: Organizations configure their own departments, responsibilities, request types, task types, and workflows at runtime.
- **Strict Backend Authorization**: Frontend components adapt for user experience, but authorization is strictly enforced at the API route and database query layer:
  $$\text{Access} \iff \text{OrgMatch} \land \text{RoleMatch} \land (\text{DeptScopeMatch} \lor \text{OwnershipMatch})$$
- **Authorized Pulse AI Copilot**: Rather than an unconstrained chatbot, Pulse AI uses scoped tool calling with role-based access control (RBAC). A manager in IT cannot query confidential Finance data via Pulse AI.
- **Universal Approval Policy Engine**: Requests automatically evaluate governance rules (e.g. monetary thresholds, keywords like *Rectification*, *Portal*, *Budget*, *VC*) to activate executive approval gates before operational execution begins.
- **Active SLA Daemon**: Background daemon monitors active requests and flags bottlenecks with overdue escalation tags and audit logs.

---

## 2. How to Run the Application

### Prerequisites
- Node.js (v18+)
- npm

### Starting the Servers

Open your terminal in the `WorkPulse` root directory:

#### Option A: Concurrent Start (Both Backend and Frontend)
```bash
npm run dev
```

#### Option B: Separate Terminals

**Terminal 1 — Backend API Server (Port 5000):**
```bash
cd backend
npm run dev
```
*Backend runs at `http://localhost:5000` connected to PostgreSQL/Supabase.*

**Terminal 2 — Frontend Client (Port 3000):**
```bash
cd frontend
npm run dev
```
*Frontend runs at `http://localhost:3000`.*

---

## 3. Demo Personas & Credentials

The system comes pre-seeded with realistic enterprise and academic personas:

| Persona | Role | Department | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **System Admin / Vice-Chancellor** | `SUPER_ADMIN` | Global / Executive | `admin@acme.com` | `admin123` | Create departments, assign managers, grant executive approvals, view global audit logs. |
| **Muhammad Tariq** | `MANAGER` | Information Technology (IT) | `muhammad@acme.com` | `manager123` | View IT queue, assign tasks to technicians, review task results, ask Pulse AI about IT operations. |
| **Sarah Connor** | `MANAGER` | Finance & Accounting | `sarah@acme.com` | `manager123` | Manage financial requests, review budget approvals. |
| **Aisha Patel** | `EMPLOYEE` | Engineering / Student Persona | `aisha@acme.com` | `employee123` | Submit requests, upload document attachments, view personal request status. |
| **Ahmed Khan** | `EMPLOYEE` | Information Technology (Technician) | `ahmed@acme.com` | `employee123` | View assigned technical tasks, update task status (`IN_PROGRESS`, `DONE`), log resolution notes. |

---

## 4. Step-by-Step Feature Walkthroughs

### Walkthrough 1: One-Click Guided Section 33 Scenario Bar
At the very top of the web interface (`http://localhost:3000`), WorkPulse provides an interactive **Section 33 Scenario Controller Bar**:
1. Click **"Run Full Demo"** or click individual steps:
   - **Step 1**: Logs in as Super Admin and creates the IT Department with responsibilities and request types.
   - **Step 2**: Assigns **Muhammad Tariq** as the IT Department Manager.
   - **Step 3**: Switches session to Muhammad and verifies the IT Manager Dashboard.
   - **Step 4**: Logs in as Aisha Patel and submits a *Software Installation Request*.
   - **Step 5**: Switches to Muhammad and delegates task `TSK-201` to technician **Ahmed Khan**.
   - **Step 6**: Switches to Ahmed, updates task status to `IN_PROGRESS` and then `DONE` with resolution notes.
   - **Step 7**: Muhammad verifies completion and closes the request.
   - **Step 8**: Verifies the immutable audit trail and triggers Pulse AI.
2. Watch the live status badges, persona badges, and data refresh automatically!

---

### Walkthrough 2: High-Stakes Governance & Executive Approval Gate
To demonstrate governance policies (e.g. University Course Slip Rectification or High-Budget Requisition):
1. Log in as **Aisha Patel** (`aisha@acme.com` / `employee123`).
2. Click **"+ New Request"** in the top right.
3. Fill in:
   - **Title**: `Level 300 First Semester Course Registration Rectification (Exam Slip #EXAM-301)`
   - **Department**: `Information Technology`
   - **Priority**: `URGENT`
   - **Description**: `Exam submitted, course code CSC-311 missing from exam slip. Requesting Vice-Chancellor approval for MIS portal change.`
4. Click **"Submit Request"**.
5. **Observe**: The request status immediately becomes **`PENDING_APPROVAL`** with an amber shield badge indicating executive authorization is required.
6. Open the request detail modal and attach proof documents (e.g., `Exam_Slip.pdf` and `VC_Petition.pdf`).
7. Log out and log in as **Super Admin / Vice-Chancellor** (`admin@acme.com` / `admin123`).
8. Notice the **Executive Notification Bell** in the top navigation with an unread alert for this request.
9. Open the request and click **"Approve Request"** with approval notes:
   *"Approved by Vice-Chancellor: MIS Portal authorized to update database."*
10. **Result**: The request immediately transitions to **`ACTIVE`**, and an automated operational execution task is generated for the IT technicians!

---

### Walkthrough 3: Strict Cross-Department Security & 403 Scoping
Demonstrate that frontend role hiding is backed by rigid backend security:
1. Log in as **Muhammad Tariq** (`muhammad@acme.com` / `manager123`).
2. Observe Muhammad's dashboard: He sees **only** IT department requests and requests he personally submitted.
3. Attempting to fetch a Finance confidential request (`REQ-1088`) directly via API returns:
   ```json
   {
     "success": false,
     "error": {
       "code": "FORBIDDEN",
       "message": "Access denied: Request belongs to department dept-fin which is outside your authorized scope."
     }
   }
   ```
4. This guarantees that unauthorized managers cannot inspect other departments' queues.

---

### Walkthrough 4: Pulse AI Copilot & Access Boundaries
1. While logged in as **Muhammad Tariq**, click the **"Pulse AI"** button in the top navigation or bottom-right drawer.
2. Type:
   > *"How many IT requests are currently pending?"*
3. **Pulse AI Output**: Grounded response summarizing the live count of active, waiting, and pending requests in the IT queue.
4. Now type:
   > *"Show me Finance confidential requests"*
5. **Pulse AI Output**:
   > ⛔ **Access Denied**: Your role (`MANAGER` in `Information Technology`) is not authorized to inspect Finance department records.
6. Check the **Audit Log** tab as Super Admin: Every Pulse AI query and security restriction is permanently logged with timestamp and actor ID.

---

### Walkthrough 5: Pending Radar & SLA Escalation ("Why Is This Stuck?")
1. Look at the **Pending Radar** section on the main dashboard.
2. Requests flagged with dependencies (e.g., waiting on supplier quote, external vendor, or missing document) display a **"Why is this stuck?"** button.
3. Click **"Why is this stuck?"** on any stalled request.
4. A diagnostic modal opens showing:
   - Current bottleneck reason (e.g., *Waiting on Vendor Procurement Quote*).
   - Time elapsed in current state.
   - Recommended unblocking action (e.g., *Ping vendor contact or escalate to Department Head*).

---

## 5. How to Run the Automated Test Suites

WorkPulse includes 3 comprehensive automated test suites that run independently from Node.js:

```bash
# 1. Core End-to-End System & Security Test Suite
node test_system.js

# 2. Universal Approval Policy Engine Test Suite
node test_approval_policy.js

# 3. SLA Daemon, File Attachments & University Case Study
node test_phases_5_6_7.js
```

### What Each Test Suite Validates:
- **`test_system.js`**: Health check, JWT authentication, configuration-driven departments, Department scoping, 403 Forbidden cross-department denial, Pulse AI authorized vs. unauthorized queries, technician task dispatch, and immutable audit logs.
- **`test_approval_policy.js`**: High-stakes approval gate detection, routine request bypass, unauthorized employee decision rejection (403), executive approval resolution, status unlock, and automated execution task creation.
- **`test_phases_5_6_7.js`**: Background SLA escalation daemon, multi-document file uploads, real-time in-app executive notification dispatch, and the full University Student Course Rectification scenario.

---

## 6. Academic & Technical Defense Highlights

When defending this project in an evaluation or presentation, highlight these architectural achievements:

1. **Defensible Security Model**:
   - Authentication is dual-layer: JWT token validation + runtime database permission and department match.
   - No sensitive department filtering happens client-side; SQL/repository queries are scoped using `WHERE department_id = $deptId`.

2. **Grounded AI with Least Privilege**:
   - Pulse AI does not have direct, raw database execution permissions.
   - Pulse AI utilizes deterministic function tools (`get_department_requests`, `why_is_this_stuck`), and the tool executor runs through the same backend RBAC authorization middleware as REST endpoints.

3. **Resilience & Dual Database Engine**:
   - Supports both persistent cloud PostgreSQL/Supabase and an in-memory seed repository fallback with identical repository interfaces (`IRequestRepository`, `IDepartmentRepository`, `IUserRepository`, `IAuditRepository`).

4. **Auditability & Traceability**:
   - Every status change, task assignment, executive approval, and AI copilot interaction writes an immutable record to the `audit_logs` table with actor metadata.
