-- Adds an organization type so the app can use the right titles
-- (e.g. Vice-Chancellor for universities, CEO for companies).
-- Run once in Supabase Dashboard → SQL Editor.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS org_type TEXT NOT NULL DEFAULT 'COMPANY';

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_org_type_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_org_type_check
  CHECK (org_type IN ('COMPANY', 'UNIVERSITY', 'SCHOOL', 'HOSPITAL', 'GOVERNMENT', 'NGO'));

-- Refresh PostgREST schema cache so the API sees the new column immediately
NOTIFY pgrst, 'reload schema';
