import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

export async function clearAllDatabase() {
  console.log('🔄 Starting complete WorkPulse database reset...');

  const deleteTable = async (tableName) => {
    try {
      const { error } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        // Fallback for tables where id is string or custom
        const { error: altError } = await supabase.from(tableName).delete().gte('created_at', '1970-01-01');
        if (altError) {
          console.warn(`⚠️ Table ${tableName} clear returned:`, altError.message || error.message);
          return;
        }
      }
      console.log(`✅ Cleared ${tableName}`);
    } catch (err) {
      console.warn(`⚠️ Table ${tableName} exception:`, err.message);
    }
  };

  // 1. Operational request dependencies
  await deleteTable('attachments');
  await deleteTable('comments');
  await deleteTable('timeline_events');
  await deleteTable('approvals');
  await deleteTable('tasks');
  await deleteTable('notifications');
  await deleteTable('audit_logs');
  await deleteTable('requests');

  // 2. Department configurations
  await deleteTable('department_request_types');

  // Break circular foreign keys between users and departments before deletion
  try {
    await supabase.from('users').update({ department_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (e) {
    // ignore
  }

  try {
    await supabase.from('departments').update({ manager_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (e) {
    // ignore
  }

  // 3. Departments, workflows, users, organizations
  await deleteTable('departments');
  await deleteTable('workflow_steps');
  await deleteTable('workflow_templates');
  await deleteTable('users');
  await deleteTable('organizations');

  console.log('🎉 WorkPulse database has been completely wiped and reset to a clean state!');
}

if (process.argv[1]?.endsWith('reset-db.mjs')) {
  clearAllDatabase();
}
