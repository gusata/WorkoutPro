'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSupabase } from '@/lib/supabaseClient'

export const MOBILE_REDIRECT_URL = 'workoutpro://auth/callback'

export type CallbackPayload =
  | { type: 'code'; code: string }
  | { type: 'tokens'; access_token: string; refresh_token: string }
  | { type: 'error'; message: string }

/**
 * Parses the OAuth deep link. PKCE returns `?code=`; the legacy implicit flow
 * returned tokens in the hash, which is still accepted for in-flight logins.
 */
export function parseCallbackUrl(url: string): CallbackPayload | null {
  const parsed = new URL(url)
  const query = new URLSearchParams(parsed.search)
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))

  const errorDescription = query.get('error_description') ?? hash.get('error_description')
  if (errorDescription) return { type: 'error', message: errorDescription }

  const code = query.get('code')
  if (code) return { type: 'code', code }

  const accessToken = hash.get('access_token') ?? query.get('access_token')
  const refreshToken = hash.get('refresh_token') ?? query.get('refresh_token')
  if (accessToken && refreshToken) return { type: 'tokens', access_token: accessToken, refresh_token: refreshToken }
  return null
}

/** Completes a native OAuth deep link. Returns false when the URL is not an auth callback. */
export async function completeAuthCallback(client: SupabaseClient, url: string): Promise<boolean> {
  const payload = parseCallbackUrl(url)
  if (!payload) return false
  if (payload.type === 'error') throw new Error(payload.message)
  const { error } = payload.type === 'code'
    ? await client.auth.exchangeCodeForSession(payload.code)
    : await client.auth.setSession({ access_token: payload.access_token, refresh_token: payload.refresh_token })
  if (error) throw error
  return true
}

export async function signInWithGoogle() {
  const supabase = requireSupabase()
  const { Capacitor } = await import('@capacitor/core')
  const isNative = Capacitor.isNativePlatform()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: isNative ? MOBILE_REDIRECT_URL : `${window.location.origin}/profile`,
      skipBrowserRedirect: isNative,
    },
  })

  if (error) throw error

  if (isNative && data.url) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url: data.url, windowName: '_self' })
  }
}
