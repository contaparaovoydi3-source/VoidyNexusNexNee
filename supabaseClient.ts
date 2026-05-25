import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dzngjrrhsqgwajtqtqke.supabase.co';
const supabaseAnonKey = 'sb_publishable_u4MzN1msqjHqH4AsRCY2nw_sodo5z4T';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
