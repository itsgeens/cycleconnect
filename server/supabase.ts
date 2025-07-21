import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL; // Read from environment variable
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Read from environment variable

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);