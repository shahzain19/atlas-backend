import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role for backend logic

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials missing. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in server/.env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
