'use client'

import { useEffect, useState } from 'react'
import { Cloud, Dumbbell } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabaseClient'
import { sessionFromCallbackUrl, signInWithGoogle } from '@/lib/authFlow'
import { runAutomaticSync, syncLocalDataToSupabase } from '@/lib/supabaseSync'
import { seedDemoData } from '@/lib/seed'
import { queueFullSync } from '@/lib/syncQueue'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useProfileStore } from '@/stores/useProfileStore'

const SKIP_AUTH_KEY = 'workoutpro.auth.skip'

export function clearAuthSkipPreference() {
  window.localStorage.removeItem(SKIP_AUTH_KEY)
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [skipped, setSkipped] = useState(() => (
    typeof window !== 'undefined' && window.localStorage.getItem(SKIP_AUTH_KEY) === '1'
  ))
  const [loadingLogin, setLoadingLogin] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const loadWorkouts = useWorkoutStore((state) => state.load)
  const loadProfile = useProfileStore((state) => state.load)

  useEffect(() => {
    let active = true
    let removeAppUrlListener: (() => void) | undefined

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.localStorage.removeItem(SKIP_AUTH_KEY)
      setSkipped(false)
      setSession(nextSession)
      setReady(true)
    })

    import('@capacitor/core')
      .then(async ({ Capacitor }) => {
        if (!Capacitor.isNativePlatform()) return
        const [{ App }, { Browser }] = await Promise.all([
          import('@capacitor/app'),
          import('@capacitor/browser'),
        ])

        const handle = await App.addListener('appUrlOpen', async ({ url }) => {
          try {
            const callbackSession = sessionFromCallbackUrl(url)
            if (!callbackSession) return
            const { error } = await supabase.auth.setSession(callbackSession)
            await Browser.close()
            if (error) throw error
            window.localStorage.removeItem(SKIP_AUTH_KEY)
            setStatus(null)
          } catch {
            setStatus('Nao foi possivel concluir o login.')
          }
        })

        removeAppUrlListener = () => {
          handle.remove()
        }
      })
      .catch(() => {
        // Web build: native auth helpers are optional.
      })

    return () => {
      active = false
      listener.subscription.unsubscribe()
      removeAppUrlListener?.()
    }
  }, [])

  useEffect(() => {
    if (!ready || (!session && !skipped)) return

    let active = true

    async function loadAppData() {
      try {
        if (session) {
          await runAutomaticSync()
        } else {
          await seedDemoData()
        }
      } catch {
        await seedDemoData()
        if (session) {
          await queueFullSync()
          await syncLocalDataToSupabase()
        }
      } finally {
        if (!active) return
        await Promise.all([loadWorkouts(), loadProfile()])
      }
    }

    loadAppData()

    return () => {
      active = false
    }
  }, [loadProfile, loadWorkouts, ready, session, skipped])

  useEffect(() => {
    if (!session) return

    let timer: number | undefined
    let running = false

    async function syncAndReload() {
      if (running) return
      running = true
      try {
        await runAutomaticSync()
        await Promise.all([loadWorkouts(), loadProfile()])
      } catch {
        // Automatic sync is best-effort; manual buttons show user-facing errors.
      } finally {
        running = false
      }
    }

    function scheduleSync() {
      window.clearTimeout(timer)
      timer = window.setTimeout(syncAndReload, 1200)
    }

    function syncWhenVisible() {
      if (document.visibilityState === 'visible') scheduleSync()
    }

    window.addEventListener('workoutpro:sync-needed', scheduleSync)
    window.addEventListener('online', scheduleSync)
    document.addEventListener('visibilitychange', syncWhenVisible)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('workoutpro:sync-needed', scheduleSync)
      window.removeEventListener('online', scheduleSync)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [loadProfile, loadWorkouts, session])

  async function handleLogin() {
    setLoadingLogin(true)
    setStatus(null)

    try {
      await signInWithGoogle()
    } catch {
      setStatus('Nao foi possivel abrir o login do Google.')
      setLoadingLogin(false)
    }
  }

  function continueOffline() {
    window.localStorage.setItem(SKIP_AUTH_KEY, '1')
    setSkipped(true)
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    )
  }

  if (!session && !skipped) {
    return (
      <main className="min-h-screen px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.25rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex min-h-[calc(100vh-3.75rem)] w-full max-w-sm flex-col">
          <section className="flex flex-1 flex-col items-center justify-center pb-8 pt-10">
            <div className="flex h-24 w-24 items-center justify-center border border-[var(--hairline)] bg-[var(--glass)] shadow-[var(--shadow-soft)] backdrop-blur-md">
              <div className="text-center leading-[0.88]">
                <span className="block text-2xl font-black tracking-tight text-[var(--foreground)]">Workout</span>
                <span className="block text-2xl font-black tracking-tight text-[var(--foreground)]">Pro</span>
              </div>
            </div>

            <div className="mt-14 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                Bem-vindo de volta
              </h1>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[var(--muted)]">
                Entre para sincronizar seus treinos e restaurar seus dados em qualquer aparelho.
              </p>
            </div>
          </section>

          <section className="space-y-3 pb-8">
            <Button className="h-13 w-full text-[15px]" onClick={handleLogin} disabled={loadingLogin}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-[#4285f4]">
                G
              </span>
              Entrar com Google
            </Button>

            <Button variant="outline" className="h-13 w-full bg-[var(--glass-strong)] text-[15px]" onClick={continueOffline} disabled={loadingLogin}>
              <Dumbbell size={16} />
              Usar sem conta
            </Button>

            <div className="flex items-center gap-3 py-2">
              <span className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-[11px] font-medium text-[var(--muted)]">ou</span>
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--glass)] px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="soft-icon flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
                  <Cloud size={17} />
                </div>
                <p className="text-xs leading-5 text-[var(--muted)]">
                  Seus dados continuam offline até você conectar uma conta.
                </p>
              </div>
            </div>

            {status && (
              <p className="rounded-2xl border border-[var(--border)] px-3 py-2 text-center text-xs text-[var(--muted)]">
                {status}
              </p>
            )}
          </section>

          <button
            type="button"
            onClick={continueOffline}
            disabled={loadingLogin}
            className="mx-auto pb-1 text-xs font-semibold text-[var(--muted)] underline underline-offset-4 disabled:opacity-40"
          >
            Entrar depois nas configuracoes
          </button>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
