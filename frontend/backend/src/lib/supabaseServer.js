import { createAdminClient, createContextClient, resolveEnv, verifyAuth } from '@supabase/server/core';
import WebSocket from 'ws';

const supabaseOptions = {
  realtime: {
    transport: WebSocket,
  },
};

export function requireSupabaseEnv() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_JWKS_URL',
  ];

  for (const key of required) {
    const value = process.env[key];
    if (!value || !String(value).trim()) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const { error } = resolveEnv();
  if (error) throw error;
}

export function createSupabaseAdmin() {
  return createAdminClient({ supabaseOptions });
}

export function createSupabaseAnon() {
  return createContextClient({ supabaseOptions });
}

export async function verifySupabaseRequest(request, auth = 'user') {
  return verifyAuth(request, { auth });
}
