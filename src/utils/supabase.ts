/**
 * Supabase Client Configuration
 * Telegram Bot - Database Connection
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

// Create and export Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false, // Serverless environment doesn't need session persistence
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'telegram-bot-prompt-manager',
    },
  },
});

// Export types for use in other files
export type SupabaseClient = typeof supabase;