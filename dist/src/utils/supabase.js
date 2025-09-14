"use strict";
/**
 * Supabase Client Configuration
 * Telegram Bot - Database Connection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
// Environment variables for Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required');
}
// Create and export Supabase client
exports.supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
