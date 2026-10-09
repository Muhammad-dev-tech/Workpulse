# WorkPulse Database Schema & Supabase Specification

## 1. Entities & Relationships

| Entity | Description | Key Fields |
| :--- | :--- | :--- |
| **Organization** | Tenant boundary | `id`, `name`, `slug`, `plan`, `createdAt` |
| **User** | Member of an organization | `id`, `organizationId`, `email`, `name`, `role`, `departmentId`, `avatarUrl` |
| **Department** | Operational silo/team | `id`, `organizationId`, `name`, `code` (e.g. IT, PROC, FIN), `managerId` |
| **Request** | Unit of internal work | `id`, `requestId` (`REQ-1001`), `organizationId`, `title`, `description`, `priority`, `status`, `stageId`, `assigneeId`, `waitingOn`, `dueDate` |
| **WorkflowTemplate**| Sequence of stages | `id`, `organizationId`, `name`, `description`, `departmentId`, `steps` |
| **WorkflowStep** | Individual stage in workflow | `id`, `templateId`, `stepOrder`, `name`, `departmentId`, `requiredRole`, `slaHours` |
| **Approval** | Formal decision node | `id`, `requestId`, `stepId`, `approverId`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `notes` |
| **TimelineEvent** | Immutable audit trail | `id`, `requestId`, `eventType`, `actorId`, `details`, `timestamp` |
| **Comment** | Collaboration messages | `id`, `requestId`, `authorId`, `content`, `createdAt` |
| **Notification** | Realtime and in-app alerts | `id`, `userId`, `organizationId`, `title`, `message`, `read`, `link` |
| **AiAuditLog** | Pulse AI tool actions | `id`, `organizationId`, `userId`, `toolName`, `actionPayload`, `confirmed`, `timestamp` |

---

## 2. Request Status Lifecycle

```
             +-----------+
             |   DRAFT   |
             +-----+-----+
                   |
                   v
             +-----------+
             | SUBMITTED |
             +-----+-----+
                   |
                   v
             +-----------+ <------------------------+
   +-------> |  ACTIVE   |                          |
   |         +--+-----+--+                          |
   |            |     |                             |
   |            v     v                             |
   |    +---------+  +-------------------+          |
   +----+ WAITING |  | PENDING_APPROVAL  |          |
        +---------+  +---------+---------+          |
                               |                    |
                               v                    |
                      +--------+--------+           |
                      |                 |           |
                      v                 v           |
                 +----------+      +----------+     |
                 | APPROVED |      | REJECTED | ----+
                 +----+-----+      +----------+
                      |
                      v
                +-----------+
                | COMPLETED |
                +-----------+
```
