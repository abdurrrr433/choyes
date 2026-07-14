import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// All four env vars are needed for full Supabase admin access.
// The backend only uses Supabase for the optional /health/supabase
// diagnostic endpoint — the main auth flow uses Prisma + JWT directly.
const REQUIRED_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
];

export function hasSupabaseEnv() {
  return REQUIRED_KEYS.every((key) => {
    const value = process.env[key];
    return value && String(value).trim();
  });
}

export function requireSupabaseEnv() {
  for (const key of REQUIRED_KEYS) {
    const value = process.env[key];
    if (!value || !String(value).trim()) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

// Anon client — for public/user-scoped operations
export function createSupabaseAnon() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false },
      realtime: { transport: WebSocket },
    }
  );
}

// Admin client — uses the service role key, bypasses RLS
export function createSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket },
    }
  );
}

// Verify a user JWT from a request (Authorization: Bearer <token>)
export async function verifySupabaseRequest(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { user: null, error: new Error('Missing token') };

  const anon = createSupabaseAnon();
  const { data, error } = await anon.auth.getUser(token);
  return { user: data?.user ?? null, error };
}
