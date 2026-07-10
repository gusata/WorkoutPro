'use client'

import { useEffect, useState } from 'react'
import { Cloud, DownloadCloud, LogIn, LogOut, Mail, UploadCloud } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabaseClient'
import { restoreSupabaseDataToLocal, syncLocalDataToSupabase } from '@/lib/supabaseSync'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { signInWithGoogle as startGoogleSignIn } from '@/lib/authFlow'
import { clearLocalData } from '@/lib/db'
import { clearAuthSkipPreference } from '@/components/auth/AuthGate'

export function SupabaseAccountCard() {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const loadWorkouts = useWorkoutStore((state) => state.load)
  const loadProfile = useProfileStore((state) => state.load)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function handleSignInWithGoogle() {
    setStatus(null)
    setLoading(true)

    try {
      await startGoogleSignIn()
    } catch {
      setStatus('Nao foi possivel abrir o login do Google.')
      setLoading(false)
    }
  }

  async function signOut() {
    setStatus(null)
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setStatus('Nao foi possivel sair da conta.')
      setLoading(false)
      return
    }
    clearAuthSkipPreference()
    await clearLocalData()
    window.location.reload()
  }

  async function uploadNow() {
    setStatus(null)
    setLoading(true)

    try {
      const result = await syncLocalDataToSupabase()
      const totalItems =
        result.workouts +
        result.exercises +
        result.sessions +
        result.measurements +
        result.achievements
      setStatus(`${totalItems} itens enviados para a nuvem.`)
    } catch {
      setStatus('Nao foi possivel sincronizar agora.')
    } finally {
      setLoading(false)
    }
  }

  async function restoreNow() {
    const confirmed = window.confirm(
      'Restaurar da nuvem vai substituir os dados locais deste aparelho. Continuar?'
    )
    if (!confirmed) return

    setStatus(null)
    setLoading(true)

    try {
      const result = await restoreSupabaseDataToLocal()
      const totalItems =
        result.workouts +
        result.exercises +
        result.sessions +
        result.measurements +
        result.achievements
      await Promise.all([loadWorkouts(), loadProfile()])
      setStatus(`${totalItems} itens restaurados da nuvem.`)
    } catch {
      setStatus('Nao foi possivel restaurar os dados da nuvem.')
    } finally {
      setLoading(false)
    }
  }

  const user = session?.user
  const name = user?.user_metadata?.full_name as string | undefined
  const email = user?.email

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="soft-icon flex h-11 w-11 flex-none items-center justify-center rounded-2xl">
            <Cloud size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">Conta na nuvem</h2>
            <p className="truncate text-xs text-zinc-500">
              {email ? name || email : 'Conecte com Google para preparar o sync'}
            </p>
          </div>
        </div>
        {email ? (
          <Button variant="outline" size="sm" onClick={signOut} disabled={loading}>
            <LogOut size={14} />
            Sair
          </Button>
        ) : (
          <Button size="sm" onClick={handleSignInWithGoogle} disabled={loading}>
            <LogIn size={14} />
            Entrar
          </Button>
        )}
      </div>

      {email && (
        <>
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--border)] px-3 py-2 text-xs text-zinc-500">
            <Mail size={13} />
            <span className="truncate">{email}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={uploadNow} disabled={loading}>
              <UploadCloud size={14} />
              Enviar
            </Button>
            <Button variant="outline" size="sm" onClick={restoreNow} disabled={loading}>
              <DownloadCloud size={14} />
              Restaurar
            </Button>
          </div>
        </>
      )}

      {status && (
        <p className="mt-3 rounded-2xl border border-[var(--border)] px-3 py-2 text-xs text-zinc-500">
          {status}
        </p>
      )}
    </Card>
  )
}
