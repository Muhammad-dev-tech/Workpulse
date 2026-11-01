import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import {
  MemoryRequestRepository,
  MemoryTaskRepository,
  MemoryWorkflowRepository,
  MemoryDepartmentRepository,
  MemoryUserRepository,
  MemoryNotificationRepository,
  MemoryAuditRepository,
  MemoryOrganizationRepository,
  wipeMemoryOrgData
} from './memoryStore';

import {
  SupabaseRequestRepository,
  SupabaseTaskRepository,
  SupabaseWorkflowRepository,
  SupabaseDepartmentRepository,
  SupabaseUserRepository,
  SupabaseNotificationRepository,
  SupabaseAuditRepository,
  SupabaseOrganizationRepository,
  wipeSupabaseOrgData
} from './supabaseStore';

const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

if (useSupabase) {
  console.log('  🗄️  Data layer: Supabase/PostgreSQL');
} else {
  console.log('  🗄️  Data layer: In-Memory Seed Store (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to use Supabase)');
}

export const organizationRepository = useSupabase ? new SupabaseOrganizationRepository() : new MemoryOrganizationRepository();
export const requestRepository      = useSupabase ? new SupabaseRequestRepository()      : new MemoryRequestRepository();
export const taskRepository         = useSupabase ? new SupabaseTaskRepository()         : new MemoryTaskRepository();
export const workflowRepository     = useSupabase ? new SupabaseWorkflowRepository()     : new MemoryWorkflowRepository();
export const departmentRepository   = useSupabase ? new SupabaseDepartmentRepository()   : new MemoryDepartmentRepository();
export const userRepository         = useSupabase ? new SupabaseUserRepository()         : new MemoryUserRepository();
export const notificationRepository = useSupabase ? new SupabaseNotificationRepository() : new MemoryNotificationRepository();
export const auditRepository        = useSupabase ? new SupabaseAuditRepository()        : new MemoryAuditRepository();

export const wipeOrgData = async (organizationId: string, options: { wipeDepartments?: boolean } = {}) => {
  if (useSupabase) {
    await wipeSupabaseOrgData(organizationId, options);
  } else {
    wipeMemoryOrgData(organizationId, options);
  }
};

export { useSupabase };
export { getSupabaseClient } from './supabaseStore';

