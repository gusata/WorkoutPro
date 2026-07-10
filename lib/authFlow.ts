'use client'

import { supabase } from '@/lib/supabaseClient'

export const MOBILE_REDIRECT_URL = 'workoutpro://auth/callback'

export function sessionFromCallbackUrl(url: string) {
  const parsed = new URL(url)
  const params = new URLSearchParams(parsed.hash.replace(/^#/, '') || parsed.search)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (!accessToken || !refreshToken) return null
  return { access_token: accessToken, refresh_token: refreshToken }
}

export async function signInWithGoogle() {
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
