'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Gym Wi-Fi is flaky: never let a request hang the UI or a sync forever. */
const REQUEST_TIMEOUT_MS = 15_000

const fetchWithTimeout: typeof fetch = (input, init) => {
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') return fetch(input, init)
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = init?.signal && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([init.signal, timeout])
    : init?.signal ?? timeout
  return fetch(input, { ...init, signal })
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // PKCE keeps tokens out of redirect URLs (recommended for native/deep-link flows).
      flowType: 'pkce',
      persistSession: true,
    },
    global: { fetch: fetchWithTimeout },
  })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase nao configurado')
  return supabase
}
