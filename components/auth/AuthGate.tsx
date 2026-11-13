'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Cloud, Dumbbell, Target } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { completeAuthCallback, signInWithGoogle } from '@/lib/authFlow'
import { hasSyncCursor, runAutomaticSync } from '@/lib/supabaseSync'
import { seedDemoData } from '@/lib/seed'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { reportError } from '@/lib/observability'

const SKIP_AUTH_KEY = 'workoutpro.auth.skip'

function hasOfflinePreference() {
  return typeof window !== 'undefined' && window.localStorage.getItem(SKIP_AUTH_KEY) === '1'
}

function subscribeToOfflinePreference(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener('workoutpro:auth-preference', onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('workoutpro:auth-preference', onStoreChange)
  }
}

function notifyOfflinePreferenceChanged() {
  window.dispatchEvent(new Event('workoutpro:auth-preference'))
}

export function clearAuthSkipPreference() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SKIP_AUTH_KEY)
  notifyOfflinePreferenceChanged()
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [skipped, setSkipped] = useState(!isSupabaseConfigured)
  const offlinePreference = useSyncExternalStore(
    subscribeToOfflinePreference,
    hasOfflinePreference,
    () => false,
  )
  const canProceed = ready || offlinePreference
  const usingOffline = skipped || offlinePreference
  const [loadingLogin, setLoadingLogin] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [dataReady, setDataReady] = useState(false)
  const loadWorkouts = useWorkoutStore((state) => state.load)
  const loadProfile = useProfileStore((state) => state.load)

  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    let removeAppUrlListener: (() => void) | undefined

    client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setReady(true)
    })

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        window.localStorage.removeItem(SKIP_AUTH_KEY)
        notifyOfflinePreferenceChanged()
        setSkipped(false)
      }
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
            const handled = await completeAuthCallback(client, url)
            if (!handled) return
            await Browser.close().catch(() => {})
            window.localStorage.removeItem(SKIP_AUTH_KEY)
            setStatus(null)
          } catch {
            await Browser.close().catch(() => {})
            setStatus('Não foi possível concluir o login.')
            setLoadingLogin(false)
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

  // Keyed by user id, not the session object: token refreshes create a new
  // session object every hour and must not reload (or unmount) the app.
  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!canProceed || (!userId && !usingOffline)) return

    let active = true

    async function reloadStores() {
      await Promise.all([loadWorkouts(), loadProfile()])
    }

    async function loadAppData() {
      // Only the very first sync of an account on this device blocks the UI: there is
      // no local copy yet, so showing the empty/demo state would be misleading.
      // Every later launch opens instantly from IndexedDB and syncs in the background.
      const firstSync = Boolean(userId && !hasSyncCursor(userId))
      if (firstSync) {
        setDataReady(false)
        try {
          await runAutomaticSync()
        } catch (error) {
          reportError('initial-data-sync', error, { authenticated: true })
          // Falhas de rede nunca devem substituir ou reenviar cegamente o banco local.
          await seedDemoData()
        }
      } else if (!userId) {
        await seedDemoData()
      }

      try {
        await reloadStores()
      } catch (error) {
        reportError('initial-data-load', error)
        if (active) setStatus('Não foi possível carregar todos os dados locais.')
      } finally {
        if (active) setDataReady(true)
      }

      if (userId && !firstSync) {
        runAutomaticSync()
          .then((result) => (active && result.pulled > 0 ? reloadStores() : undefined))
          .catch(() => {
            // Best-effort: the account card shows sync errors and pending changes.
          })
      }
    }

    void loadAppData()

    return () => {
      active = false
    }
  }, [canProceed, loadProfile, loadWorkouts, userId, usingOffline])

  useEffect(() => {
    if (!userId) return

    let timer: number | undefined
    let running = false

    async function syncAndReload() {
      if (running) return
      running = true
      try {
        const result = await runAutomaticSync()
        // Skip the full store reload (and app-wide re-render) when nothing came from the cloud.
        if (result.pulled > 0) await Promise.all([loadWorkouts(), loadProfile()])
      } catch {
        // Automatic sync is best-effort; manual buttons show user-facing errors.
      } finally {
        running = false
      }
    }

    function scheduleSync(delay = 1500) {
      window.clearTimeout(timer)
      timer = window.setTimeout(syncAndReload, delay)
    }

    const onSyncNeeded = () => scheduleSync()
    const onOnline = () => scheduleSync(300)
    function syncWhenVisible() {
      if (document.visibilityState === 'visible') scheduleSync(600)
    }

    window.addEventListener('workoutpro:sync-needed', onSyncNeeded)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', syncWhenVisible)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('workoutpro:sync-needed', onSyncNeeded)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [loadProfile, loadWorkouts, userId])

  async function handleLogin() {
    setLoadingLogin(true)
    setStatus(null)

    try {
      await signInWithGoogle()
    } catch {
      setStatus('Não foi possível abrir o login do Google.')
      setLoadingLogin(false)
    }
  }

  function continueOffline() {
    window.localStorage.setItem(SKIP_AUTH_KEY, '1')
    notifyOfflinePreferenceChanged()
    setSkipped(true)
  }

  if (!canProceed) return <LoadingScreen message="Preparando seus dados..." />

  if (!session && !usingOffline) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,calc(env(safe-area-inset-top)+3rem))]">
        <div className="page-content mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-sm flex-col">
          <section className="flex-1">
            <span aria-hidden className="flex h-[72px] w-[72px] items-center justify-center rounded-[18px] bg-[#1d1d1f] text-white">
              <Dumbbell size={34} strokeWidth={2} />
            </span>
            <p className="eyebrow mt-10">WorkoutPro</p>
            <h1 className="display mt-1">Treine com intenção.</h1>
            <p className="lede mt-3">Cada série registrada. Cada recorde, notado.</p>

            {/* Apple "What's New" feature list */}
            <ul className="mt-10 space-y-7">
              {[
                { icon: Dumbbell, color: 'var(--foreground)', title: 'Registre cada série', text: 'Carga, repetições e descanso em poucos toques, mesmo offline.' },
                { icon: Target, color: 'var(--foreground)', title: 'Evolua com método', text: 'Metas semanais, blocos de treino e alerta de deload.' },
                { icon: Cloud, color: 'var(--foreground)', title: 'Tudo sincronizado', text: 'Conecte uma conta para ter seus dados em qualquer aparelho.' },
              ].map(({ icon: Icon, color, title, text }) => (
                <li key={title} className="flex items-start gap-4">
                  <Icon size={26} strokeWidth={1.7} style={{ color }} className="mt-0.5 flex-none" aria-hidden />
                  <div>
                    <p className="headline">{title}</p>
                    <p className="subhead mt-0.5 text-[var(--muted)]">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2 pt-10">
            {status && (
              <p role="alert" className="footnote pb-2 text-center text-[var(--danger)]">{status}</p>
            )}
            <button
              type="button"
              onClick={handleLogin}
              disabled={loadingLogin}
              className="pressable flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-[var(--accent-fill)] text-[17px] text-white disabled:opacity-50"
            >
              <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-black text-[#4285f4]">G</span>
              {loadingLogin ? 'Abrindo o Google...' : 'Continuar com Google'}
            </button>
            <Button variant="ghost" size="lg" className="w-full" onClick={continueOffline} disabled={loadingLogin}>
              Usar sem conta
            </Button>
            <p className="footnote px-4 pt-1 text-center text-[var(--muted)]">
              Sem conta, seus dados ficam só neste aparelho. Você pode conectar depois em Você.
            </p>
          </section>
        </div>
      </main>
    )
  }

  if (!dataReady) return <LoadingScreen message="Sincronizando seus treinos pela primeira vez..." />

  return <>{children}</>
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center">
        <svg className="h-7 w-7 animate-spin text-[var(--muted)]" viewBox="0 0 24 24" aria-hidden>
          {Array.from({ length: 8 }, (_, index) => (
            <rect key={index} x="11" y="2" width="2" height="6" rx="1" fill="currentColor" opacity={(index + 1) / 8} transform={`rotate(${index * 45} 12 12)`} />
          ))}
        </svg>
        <p className="subhead mt-3 text-[var(--muted)]">{message}</p>
      </div>
    </div>
  )
}
