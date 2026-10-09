-- ============================================================
--  WorkPulse — Supabase PostgreSQL Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ──────────────────────────────────────────
--  EXTENSIONS
-- ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────
--  ENUM TYPES
-- ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('SUPER_ADMIN','ORG_ADMIN','MANAGER','EMPLOYEE','OPERATOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE request_priority AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('DRAFT','SUBMITTED','ACTIVE','WAITING','PENDING_APPROVAL','APPROVED','REJECTED','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('TODO','IN_PROGRESS','COMPLETED','BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('REQUEST','TASK','APPROVAL','SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE timeline_event_type AS ENUM ('CREATED','ASSIGNED','STATUS_CHANGE','STAGE_TRANSITION','WAITING_ON','COMMENT','APPROVAL','TASK_ASSIGNED','TASK_COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────
--  CORE TABLES
-- ──────────────────────────────────────────

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT PRIMARY KEY DEFAULT ('org-' || gen_random_uuid()::text),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id               TEXT PRIMARY KEY DEFAULT ('dept-' || gen_random_uuid()::text),
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  code             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  manager_id       TEXT,
  manager_name     TEXT,
  responsibilities TEXT[]   NOT NULL DEFAULT '{}',
  task_types       TEXT[]   NOT NULL DEFAULT '{}',
  employee_ids     TEXT[]   NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Approval policy enum (for department request types)
DO $$ BEGIN
  CREATE TYPE approval_policy_type AS ENUM ('DIRECT','DEPT_MANAGER','EXECUTIVE_ONLY','MULTI_TIER_CHAIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Department Request Types (sub-table of departments)
CREATE TABLE IF NOT EXISTS department_request_types (
  id                  TEXT PRIMARY KEY DEFAULT ('rt-' || gen_random_uuid()::text),
  department_id       TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  default_priority    request_priority DEFAULT 'MEDIUM',
  default_workflow_id TEXT,
  approval_policy     approval_policy_type DEFAULT 'DIRECT',
  requires_approval   BOOLEAN NOT NULL DEFAULT FALSE,
  sla_hours           INTEGER DEFAULT 48
);

-- Migration: add approval_policy to existing table if column missing
ALTER TABLE department_request_types ADD COLUMN IF NOT EXISTS approval_policy approval_policy_type DEFAULT 'DIRECT';
ALTER TABLE department_request_types ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE department_request_types ADD COLUMN IF NOT EXISTS sla_hours INTEGER DEFAULT 48;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY DEFAULT ('user-' || gen_random_uuid()::text),
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id    TEXT REFERENCES departments(id) ON DELETE SET NULL,
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT,
  name             TEXT NOT NULL,
  role             user_role NOT NULL DEFAULT 'EMPLOYEE',
  avatar_url       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key for department manager after users table exists
ALTER TABLE departments
  DROP CONSTRAINT IF EXISTS departments_manager_id_fkey;
ALTER TABLE departments
  ADD CONSTRAINT departments_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Workflow Templates
CREATE TABLE IF NOT EXISTS workflow_templates (
  id               TEXT PRIMARY KEY DEFAULT ('wf-' || gen_random_uuid()::text),
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  department_id    TEXT REFERENCES departments(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow Steps
CREATE TABLE IF NOT EXISTS workflow_steps (
  id               TEXT PRIMARY KEY DEFAULT ('step-' || gen_random_uuid()::text),
  template_id      TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  step_order       INTEGER NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  department_id    TEXT REFERENCES departments(id) ON DELETE SET NULL,
  required_role    user_role,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  sla_hours        INTEGER NOT NULL DEFAULT 24
);

-- Requests
CREATE TABLE IF NOT EXISTS requests (
  id                   TEXT PRIMARY KEY DEFAULT ('req-uuid-' || gen_random_uuid()::text),
  request_id           TEXT NOT NULL UNIQUE,  -- e.g. REQ-1001
  organization_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id         TEXT NOT NULL REFERENCES users(id),
  requester_name       TEXT,
  department_id        TEXT NOT NULL REFERENCES departments(id),
  department_name      TEXT,
  request_type_id      TEXT,
  request_type_name    TEXT,
  current_step_id      TEXT,
  current_step_name    TEXT,
  workflow_template_id TEXT REFERENCES workflow_templates(id) ON DELETE SET NULL,
  assignee_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  assignee_name        TEXT,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL DEFAULT '',
  priority             request_priority NOT NULL DEFAULT 'MEDIUM',
  status               request_status NOT NULL DEFAULT 'SUBMITTED',
  approval_policy      approval_policy_type DEFAULT 'DIRECT',
  sla_hours            INTEGER DEFAULT 48,
  waiting_on           TEXT,
  waiting_since        TIMESTAMPTZ,
  due_date             TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add approval_policy to existing requests table
ALTER TABLE requests ADD COLUMN IF NOT EXISTS approval_policy approval_policy_type DEFAULT 'DIRECT';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS sla_hours INTEGER DEFAULT 48;

-- Request sequence counter (for REQ-XXXX IDs)
CREATE SEQUENCE IF NOT EXISTS request_seq START 1001;

-- Timeline Events
CREATE TABLE IF NOT EXISTS timeline_events (
  id          TEXT PRIMARY KEY DEFAULT ('tl-' || gen_random_uuid()::text),
  request_id  TEXT NOT NULL,  -- stores the REQ-XXXX string
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name  TEXT,
  event_type  timeline_event_type NOT NULL DEFAULT 'CREATED',
  title       TEXT NOT NULL,
  details     TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY DEFAULT ('cmt-' || gen_random_uuid()::text),
  request_id  TEXT NOT NULL,  -- stores the REQ-XXXX string
  author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role user_role NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approvals
CREATE TABLE IF NOT EXISTS approvals (
  id            TEXT PRIMARY KEY DEFAULT ('appr-' || gen_random_uuid()::text),
  request_id    TEXT NOT NULL,  -- stores the REQ-XXXX string
  step_id       TEXT,
  approver_id   TEXT NOT NULL REFERENCES users(id),
  approver_name TEXT NOT NULL,
  status        approval_status NOT NULL DEFAULT 'PENDING',
  notes         TEXT,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id               TEXT PRIMARY KEY DEFAULT ('task-uuid-' || gen_random_uuid()::text),
  task_id          TEXT NOT NULL UNIQUE,  -- e.g. TSK-201
  request_id       TEXT NOT NULL,         -- stores the REQ-XXXX string
  request_title    TEXT,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id    TEXT NOT NULL REFERENCES departments(id),
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  task_type        TEXT NOT NULL,
  assignee_id      TEXT NOT NULL REFERENCES users(id),
  assignee_name    TEXT NOT NULL,
  created_by_id    TEXT NOT NULL REFERENCES users(id),
  created_by_name  TEXT NOT NULL,
  status           task_status NOT NULL DEFAULT 'TODO',
  due_date         TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  result_notes     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task sequence counter (for TSK-XXX IDs)
CREATE SEQUENCE IF NOT EXISTS task_seq START 201;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id               TEXT PRIMARY KEY DEFAULT ('notif-' || gen_random_uuid()::text),
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  message          TEXT NOT NULL,
  type             notification_type NOT NULL DEFAULT 'SYSTEM',
  link             TEXT,
  read             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id               TEXT PRIMARY KEY DEFAULT ('aud-' || gen_random_uuid()::text),
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id         TEXT NOT NULL,
  actor_name       TEXT NOT NULL,
  actor_role       TEXT NOT NULL,
  action           TEXT NOT NULL,
  resource_type    TEXT NOT NULL,
  resource_id      TEXT NOT NULL,
  details          JSONB,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
--  INDEXES (performance)
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_requests_org        ON requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_requests_dept       ON requests(department_id);
CREATE INDEX IF NOT EXISTS idx_requests_status     ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_assignee   ON requests(assignee_id);
CREATE INDEX IF NOT EXISTS idx_requests_requester  ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org           ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee      ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_request       ON tasks(request_id);
CREATE INDEX IF NOT EXISTS idx_timeline_request    ON timeline_events(request_id);
CREATE INDEX IF NOT EXISTS idx_comments_request    ON comments(request_id);
CREATE INDEX IF NOT EXISTS idx_approvals_request   ON approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_org           ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor         ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_users_org           ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);

-- ──────────────────────────────────────────
--  updated_at auto-trigger
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS requests_updated_at ON requests;
CREATE TRIGGER requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────
--  SEED DATA  (Acme Technologies Inc.)
-- ──────────────────────────────────────────

-- Organization
INSERT INTO organizations (id, name, slug, plan, created_at)
VALUES ('org-acme-1', 'Acme Technologies Inc.', 'acme', 'enterprise', '2026-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Departments (insert before users so FK is satisfied)
INSERT INTO departments (id, organization_id, name, code, description, responsibilities, task_types, employee_ids, created_at)
VALUES
  ('dept-it',   'org-acme-1', 'Information Technology',      'IT',   'Handles organizational technology, network infrastructure, software provisioning, and technical support.',
   ARRAY['Technical Support','Software Management','Account Management','System Administration'],
   ARRAY['Diagnose issue','Install software','Reset account','Configure workstation','Resolve technical problem'],
   ARRAY['user-aisha','user-ahmed'], '2026-01-01T00:00:00Z'),

  ('dept-fin',  'org-acme-1', 'Finance & Accounting',         'FIN',  'Budget allocations, expense reimbursements, purchase order verification, and financial audits.',
   ARRAY['Budget Approval','Expense Reimbursement','Vendor Invoicing','Financial Auditing'],
   ARRAY['Verify Receipts','Audit Budget Allocation','Process Bank Transfer'],
   ARRAY['user-sarah'], '2026-01-01T00:00:00Z'),

  ('dept-proc', 'org-acme-1', 'Procurement & Supply Chain',   'PROC', 'Vendor relationship management, asset sourcing, hardware quotes, and contract fulfillment.',
   ARRAY['Vendor Sourcing','Hardware Procurement','Supplier Quotations','Asset Delivery'],
   ARRAY['Contact Vendor','Compare Quotations','Issue Purchase Order','Track Shipment'],
   ARRAY['user-ibrahim'], '2026-01-01T00:00:00Z'),

  ('dept-sales','org-acme-1', 'Sales & Business Development',  'SALES','Customer acquisition, deal management, CRM operations, and partnership negotiations.',
   ARRAY['Lead Generation','Deal Closure','CRM Management','Partner Relations'],
   ARRAY['Follow up lead','Update CRM','Prepare proposal','Close deal'],
   ARRAY['user-elena'], '2026-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Users (passwords: bcrypt of 'admin123', 'manager123', 'employee123')
INSERT INTO users (id, organization_id, department_id, email, password_hash, name, role, avatar_url, created_at)
VALUES
  ('user-superadmin', 'org-acme-1', NULL,          'admin@acme.com',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: admin123
   'System Administrator', 'SUPER_ADMIN',
   'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&fit=crop', '2026-01-01T00:00:00Z'),

  ('user-alex',        'org-acme-1', 'dept-it',    'alex@acme.com',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'Alex Vance', 'ORG_ADMIN',
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&fit=crop', '2026-01-01T00:00:00Z'),

  ('user-muhammad',    'org-acme-1', 'dept-it',    'muhammad@acme.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- password: manager123
   'Muhammad Tariq', 'MANAGER',
   'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&fit=crop', '2026-01-01T00:00:00Z'),

  ('user-sarah',       'org-acme-1', 'dept-fin',   'sarah@acme.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
   'Sarah Connor', 'MANAGER',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&fit=crop', '2026-01-03T00:00:00Z'),

  ('user-aisha',       'org-acme-1', 'dept-it',    'aisha@acme.com',
   '$2a$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgaHb9cbcoQgdIXmkDfctlCQVrS', -- password: employee123
   'Aisha Patel', 'EMPLOYEE',
   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=128&fit=crop', '2026-01-04T00:00:00Z'),

  ('user-ahmed',       'org-acme-1', 'dept-it',    'ahmed@acme.com',
   '$2a$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgaHb9cbcoQgdIXmkDfctlCQVrS',
   'Ahmed Khan', 'EMPLOYEE',
   'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=128&fit=crop', '2026-01-04T00:00:00Z'),

  ('user-ibrahim',     'org-acme-1', 'dept-proc',  'ibrahim@acme.com',
   '$2a$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgaHb9cbcoQgdIXmkDfctlCQVrS',
   'Ibrahim Al-Mansoor', 'EMPLOYEE',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&fit=crop', '2026-01-02T00:00:00Z'),

  ('user-elena',       'org-acme-1', 'dept-sales', 'elena@acme.com',
   '$2a$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgaHb9cbcoQgdIXmkDfctlCQVrS',
   'Elena Rostova', 'EMPLOYEE',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&fit=crop', '2026-01-05T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Set department managers
UPDATE departments SET manager_id = 'user-muhammad', manager_name = 'Muhammad Tariq' WHERE id = 'dept-it';
UPDATE departments SET manager_id = 'user-sarah',    manager_name = 'Sarah Connor'    WHERE id = 'dept-fin';
UPDATE departments SET manager_id = 'user-ibrahim',  manager_name = 'Ibrahim Al-Mansoor' WHERE id = 'dept-proc';
UPDATE departments SET manager_id = 'user-elena',    manager_name = 'Elena Rostova'   WHERE id = 'dept-sales';

-- Workflow Templates
INSERT INTO workflow_templates (id, organization_id, name, description, department_id, created_at)
VALUES
  ('wf-it-support', 'org-acme-1', 'IT Technical Support & Provisioning',
   'Employee submits request -> IT Manager reviews -> Task assigned to technician -> Technician works -> Manager verifies -> Request completed.',
   'dept-it', '2026-01-01T00:00:00Z'),
  ('wf-hardware',   'org-acme-1', 'Hardware Procurement & Replacement',
   'Multi-stage workflow for device replacement, quotation, finance authorization, and delivery.',
   'dept-proc', '2026-01-01T00:00:00Z'),
  ('wf-expense',    'org-acme-1', 'Expense Reimbursement & Invoice Approval',
   'Employee submit receipts -> Manager check -> Finance approval -> Wire transfer.',
   'dept-fin', '2026-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Workflow Steps
INSERT INTO workflow_steps (id, template_id, step_order, name, department_id, required_role, requires_approval, sla_hours)
VALUES
  -- IT Support
  ('step-it-1', 'wf-it-support', 1, 'Employee Submission',                    NULL,        NULL,       FALSE, 2),
  ('step-it-2', 'wf-it-support', 2, 'IT Manager Review & Task Assignment',    'dept-it',   'MANAGER',  FALSE, 12),
  ('step-it-3', 'wf-it-support', 3, 'Technician Work & Resolution',           'dept-it',   'EMPLOYEE', FALSE, 24),
  ('step-it-4', 'wf-it-support', 4, 'Manager Final Verification',             'dept-it',   'MANAGER',  TRUE,  12),
  -- Hardware
  ('step-hw-1', 'wf-hardware',   1, 'Manager Approval',                        NULL,        'MANAGER',  TRUE,  24),
  ('step-hw-2', 'wf-hardware',   2, 'IT Technical Assessment',                'dept-it',   NULL,       FALSE, 12),
  ('step-hw-3', 'wf-hardware',   3, 'Procurement & Quotation',                'dept-proc', NULL,       FALSE, 48),
  ('step-hw-4', 'wf-hardware',   4, 'Finance PO Approval',                    'dept-fin',  'MANAGER',  TRUE,  24),
  ('step-hw-5', 'wf-hardware',   5, 'Vendor Delivery & Setup',                'dept-it',   NULL,       FALSE, 48),
  -- Expense
  ('step-ex-1', 'wf-expense',    1, 'Receipt Submission',                      NULL,        NULL,       FALSE, 24),
  ('step-ex-2', 'wf-expense',    2, 'Department Review',                       NULL,        'MANAGER',  TRUE,  48),
  ('step-ex-3', 'wf-expense',    3, 'Finance Audit & Wire Transfer',          'dept-fin',  'MANAGER',  FALSE, 72)
ON CONFLICT (id) DO NOTHING;

-- Department Request Types
INSERT INTO department_request_types (id, department_id, name, description, default_priority, default_workflow_id)
VALUES
  ('rt-it-1',   'dept-it',   'Software Installation',    'Request software tools and licensed IDEs/utilities.',                    'MEDIUM', 'wf-it-support'),
  ('rt-it-2',   'dept-it',   'Account Access',           'Request cloud credentials, VPN, or permission changes.',                 'HIGH',   'wf-it-support'),
  ('rt-it-3',   'dept-it',   'Technical Support',        'Report system bugs, workstation crashes, or network faults.',            'URGENT', 'wf-it-support'),
  ('rt-it-4',   'dept-it',   'Hardware Setup',           'Request monitor, peripheral setup, or docking stations.',               'LOW',    'wf-hardware'),
  ('rt-fin-1',  'dept-fin',  'Expense Reimbursement',    'Submit travel or client-related receipts for reimbursement.',            'MEDIUM', 'wf-expense'),
  ('rt-fin-2',  'dept-fin',  'Purchase Order Approval',  'Review and approve enterprise software and vendor invoices.',            'HIGH',   'wf-expense'),
  ('rt-proc-1', 'dept-proc', 'Hardware Replacement',     'Sourcing new laptops, servers, or networking components.',              'HIGH',   'wf-hardware'),
  ('rt-proc-2', 'dept-proc', 'Vendor Quotation',         'Obtaining competitive price bids from suppliers.',                      'MEDIUM', 'wf-hardware'),
  ('rt-sales-1','dept-sales','CRM Data Entry',           'Add or update customer records in the CRM system.',                     'MEDIUM', NULL),
  ('rt-sales-2','dept-sales','Proposal Generation',      'Request a formal proposal document for a prospective client.',          'HIGH',   NULL)
ON CONFLICT (id) DO NOTHING;

-- Advance the request sequence so new requests start after seeded ones
SELECT setval('request_seq', 1088, true);
SELECT setval('task_seq', 202, true);

-- Requests
INSERT INTO requests (id, request_id, organization_id, requester_id, requester_name, department_id, department_name,
  request_type_id, request_type_name, current_step_id, current_step_name, workflow_template_id,
  assignee_id, assignee_name, title, description, priority, status, due_date, created_at, updated_at)
VALUES
  ('req-uuid-1001', 'REQ-1001', 'org-acme-1', 'user-aisha', 'Aisha Patel', 'dept-it', 'Information Technology',
   'rt-it-1', 'Software Installation', 'step-it-3', 'Technician Work & Resolution', 'wf-it-support',
   'user-ahmed', 'Ahmed Khan',
   'Software Installation - JetBrains & Docker Suite',
   'Requires local container runtime and IntelliJ Ultimate for upcoming microservices refactoring sprint.',
   'HIGH', 'ACTIVE', '2026-10-05T17:00:00Z', '2026-10-01T09:00:00Z', '2026-10-01T11:00:00Z'),

  ('req-uuid-1002', 'REQ-1002', 'org-acme-1', 'user-ahmed', 'Ahmed Khan', 'dept-it', 'Information Technology',
   'rt-it-2', 'Account Access', 'step-it-2', 'IT Manager Review & Task Assignment', 'wf-it-support',
   'user-muhammad', 'Muhammad Tariq',
   'Account Access - AWS Production Read-Only',
   'Requires Read-Only CloudWatch & ECS console access to debug latency spikes in the production payment pipeline.',
   'HIGH', 'SUBMITTED', '2026-10-03T16:00:00Z', '2026-10-01T14:00:00Z', '2026-10-01T14:15:00Z'),

  ('req-uuid-1042', 'REQ-1042', 'org-acme-1', 'user-muhammad', 'Muhammad Tariq', 'dept-proc', 'Procurement & Supply Chain',
   'rt-proc-1', 'Hardware Replacement', 'step-hw-3', 'Procurement & Quotation', 'wf-hardware',
   'user-ibrahim', 'Ibrahim Al-Mansoor',
   'MacBook Pro M3 Replacement for Lead Dev',
   'Current development machine motherboard experiencing kernel panic loops. Replacement urgently required for upcoming release cycle.',
   'HIGH', 'WAITING', '2026-09-30T18:00:00Z', '2026-09-27T09:00:00Z', '2026-09-28T14:30:00Z'),

  ('req-uuid-1088', 'REQ-1088', 'org-acme-1', 'user-sarah', 'Sarah Connor', 'dept-fin', 'Finance & Accounting',
   'rt-fin-2', 'Purchase Order Approval', 'step-ex-3', 'Finance Audit & Wire Transfer', 'wf-expense',
   'user-sarah', 'Sarah Connor',
   'Quarterly Cloud Infrastructure Expense Reimbursement',
   'Internal financial audit and budget reconciliation for quarterly AWS & GCP enterprise billing.',
   'HIGH', 'ACTIVE', '2026-10-10T18:00:00Z', '2026-10-01T08:00:00Z', '2026-10-01T08:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Tasks
INSERT INTO tasks (id, task_id, request_id, request_title, organization_id, department_id,
  title, description, task_type, assignee_id, assignee_name, created_by_id, created_by_name,
  status, due_date, created_at, updated_at)
VALUES
  ('task-uuid-201', 'TSK-201', 'REQ-1001', 'Software Installation - JetBrains & Docker Suite',
   'org-acme-1', 'dept-it',
   'Install and configure Docker Engine & IntelliJ License',
   'Provision Enterprise JetBrains license key and configure Docker Desktop daemon with proxy settings.',
   'Install software', 'user-ahmed', 'Ahmed Khan', 'user-muhammad', 'Muhammad Tariq',
   'IN_PROGRESS', '2026-10-04T18:00:00Z', '2026-10-01T10:30:00Z', '2026-10-01T11:00:00Z'),

  ('task-uuid-202', 'TSK-202', 'REQ-1002', 'Account Access - AWS Production Read-Only',
   'org-acme-1', 'dept-it',
   'Verify AWS IAM Policy and Generate Read-Only Token',
   'Audit requester credentials and attach ReadOnlyAccess policy in AWS IAM Identity Center.',
   'Reset account', 'user-aisha', 'Aisha Patel', 'user-muhammad', 'Muhammad Tariq',
   'TODO', '2026-10-03T16:00:00Z', '2026-10-01T14:15:00Z', '2026-10-01T14:15:00Z')
ON CONFLICT (id) DO NOTHING;

-- Timeline Events
INSERT INTO timeline_events (id, request_id, actor_id, actor_name, event_type, title, details, timestamp)
VALUES
  ('tl-1001-1', 'REQ-1001', 'user-aisha',    'Aisha Patel',    'CREATED',      'Request Submitted',         'Submitted software installation request for engineering tools.',       '2026-10-01T09:00:00Z'),
  ('tl-1001-2', 'REQ-1001', 'user-muhammad', 'Muhammad Tariq', 'TASK_ASSIGNED','Task Assigned to Ahmed Khan','Assigned task TSK-201 (Install software) to technician Ahmed Khan.', '2026-10-01T10:30:00Z'),
  ('tl-1002-1', 'REQ-1002', 'user-ahmed',    'Ahmed Khan',     'CREATED',      'Request Submitted',         'Submitted request for production cloud observability access.',         '2026-10-01T14:00:00Z'),
  ('tl-1002-2', 'REQ-1002', 'user-muhammad', 'Muhammad Tariq', 'TASK_ASSIGNED','Task Assigned to Aisha Patel','Assigned task TSK-202 (Verify IAM policy) to Aisha Patel.',         '2026-10-01T14:15:00Z'),
  ('tl-1042-1', 'REQ-1042', 'user-muhammad', 'Muhammad Tariq', 'CREATED',      'Request Created',           'Submitted hardware replacement request for lead developer.',          '2026-09-27T09:00:00Z'),
  ('tl-1042-2', 'REQ-1042', 'user-ibrahim',  'Ibrahim Al-Mansoor','WAITING_ON', 'Marked Waiting on Vendor', 'Sent RFQ to Apple Premier Partner. Waiting for formal quotation PDF.','2026-09-28T14:30:00Z'),
  ('tl-1088-1', 'REQ-1088', 'user-sarah',    'Sarah Connor',   'CREATED',      'Finance Internal Reconciliation','Submitted for quarterly ledger reconciliation.',               '2026-10-01T08:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Comments
INSERT INTO comments (id, request_id, author_id, author_name, author_role, content, created_at)
VALUES
  ('cmt-1',      'REQ-1001', 'user-ahmed',   'Ahmed Khan',           'EMPLOYEE', 'I have verified license server availability. Beginning workstation setup now.',                           '2026-10-01T11:05:00Z'),
  ('cmt-1042-1', 'REQ-1042', 'user-ibrahim', 'Ibrahim Al-Mansoor',   'EMPLOYEE', 'Vendor promised revised quotation with corporate educational discount by tomorrow morning.',              '2026-09-28T15:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Notifications
INSERT INTO notifications (id, user_id, organization_id, title, message, type, link, read, created_at)
VALUES
  ('notif-1', 'user-muhammad', 'org-acme-1', 'New IT Request Submitted',   'Ahmed Khan submitted "Account Access - AWS Production Read-Only" (REQ-1002).', 'REQUEST', 'REQ-1002', FALSE, '2026-10-01T14:00:00Z'),
  ('notif-2', 'user-ahmed',    'org-acme-1', 'Task Assigned to You',       'Manager Muhammad Tariq assigned task TSK-201 ("Install and configure Docker Engine") to you.', 'TASK', 'REQ-1001', FALSE, '2026-10-01T10:30:00Z'),
  ('notif-3', 'user-aisha',    'org-acme-1', 'Task Assigned to You',       'Manager Muhammad Tariq assigned task TSK-202 ("Verify AWS IAM Policy") to you.', 'TASK', 'REQ-1002', FALSE, '2026-10-01T14:15:00Z')
ON CONFLICT (id) DO NOTHING;

-- Audit Logs
INSERT INTO audit_logs (id, organization_id, actor_id, actor_name, actor_role, action, resource_type, resource_id, details, timestamp)
VALUES
  ('aud-1', 'org-acme-1', 'user-superadmin', 'System Administrator', 'SUPER_ADMIN', 'ORGANIZATION_INITIALIZED', 'Organization', 'org-acme-1', '{"name":"Acme Technologies Inc.","plan":"Enterprise"}',        '2026-01-01T00:00:00Z'),
  ('aud-2', 'org-acme-1', 'user-superadmin', 'System Administrator', 'SUPER_ADMIN', 'DEPARTMENT_CONFIGURED',    'Department',   'dept-it',    '{"name":"Information Technology","code":"IT"}',                '2026-01-01T00:05:00Z'),
  ('aud-3', 'org-acme-1', 'user-superadmin', 'System Administrator', 'SUPER_ADMIN', 'MANAGER_ASSIGNED',         'User',         'user-muhammad','{"assignedUser":"Muhammad Tariq","department":"dept-it"}',    '2026-01-01T00:10:00Z'),
  ('aud-4', 'org-acme-1', 'user-muhammad',   'Muhammad Tariq',       'MANAGER',     'TASK_ASSIGNED',            'Task',         'TSK-201',    '{"assignee":"Ahmed Khan","requestId":"REQ-1001"}',              '2026-10-01T10:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────
--  Row Level Security (optional but recommended)
-- ──────────────────────────────────────────
-- Uncomment these after confirming the schema works.
-- ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE requests        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
