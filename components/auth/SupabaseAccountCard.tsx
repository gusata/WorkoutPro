'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle, Cloud, CloudOff, DownloadCloud, LogIn, LogOut, Mail, RefreshCw, Trash2,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import {
  getSyncConflicts, getSyncOverview, resolveAllConflicts, resolveConflict, restoreSupabaseDataToLocal, runAutomaticSync,
  type SyncOverview,
} from '@/lib/supabaseSync'
import type { SyncConflict } from '@/types'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { signInWithGoogle as startGoogleSignIn } from '@/lib/authFlow'
import { clearLocalData } from '@/lib/db'
import { clearAuthSkipPreference } from '@/components/auth/AuthGate'

const initialOverview: SyncOverview = {
  phase: isSupabaseConfigured ? 'idle' : 'disabled',
  pending: 0,
  conflicts: 0,
  lastSyncedAt: null,
  message: null,
}

function syncLabel(overview: SyncOverview) {
  if (overview.phase === 'disabled') return 'Nuvem não configurada; dados somente neste aparelho'
  if (overview.phase === 'syncing') return 'Sincronizando...'
  if (overview.phase === 'offline') return `${overview.pending} alterações aguardando conexão`
  if (overview.phase === 'conflict') return `${overview.conflicts} conflitos precisam de decisão`
  if (overview.phase === 'error') return overview.message ?? 'Falha na última sincronização'
  if (overview.pending > 0) return `${overview.pending} alterações pendentes`
  if (overview.lastSyncedAt) return `Sincronizado às ${overview.lastSyncedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  return 'Pronto para sincronizar'
}

export function SupabaseAccountCard() {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [overview, setOverview] = useState<SyncOverview>(initialOverview)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const loadWorkouts = useWorkoutStore((state) => state.load)
  const loadProfile = useProfileStore((state) => state.load)

  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    Promise.all([getSyncOverview(), getSyncConflicts()]).then(([value, items]) => {
      if (!active) return
      setOverview(value)
      setConflicts(items)
    }).catch(() => {})
    const onStatus = (event: Event) => {
      setOverview((event as CustomEvent<SyncOverview>).detail)
      void getSyncConflicts().then(setConflicts)
    }
    window.addEventListener('workoutpro:sync-status', onStatus)
    return () => {
      active = false
      listener.subscription.unsubscribe()
      window.removeEventListener('workoutpro:sync-status', onStatus)
    }
  }, [])

  async function reloadStores() {
    await Promise.all([loadWorkouts(), loadProfile()])
  }

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
    const client = supabase
    if (!client) return
    setStatus(null)
    setLoading(true)
    try {
      const latest = await getSyncOverview()
      if (latest.pending > 0) {
        const shouldSync = window.confirm(
          `Existem ${latest.pending} alteracoes pendentes. Sincronizar antes de sair?`
        )
        if (shouldSync) await runAutomaticSync()
      }
      const { error } = await client.auth.signOut()
      if (error) throw error
      clearAuthSkipPreference()
      setStatus('Conta desconectada. Os dados locais foram mantidos neste aparelho.')
    } catch {
      setStatus('Nao foi possivel sair com seguranca. Seus dados locais foram preservados.')
    } finally {
      setLoading(false)
    }
  }

  async function syncNow() {
    setStatus(null)
    setLoading(true)
    try {
      const result = await runAutomaticSync()
      await reloadStores()
      setStatus(`${result.uploaded} alteracoes enviadas. ${result.conflicts} conflitos.`)
    } catch {
      setStatus('Nao foi possivel sincronizar agora. Nada foi apagado.')
    } finally {
      setLoading(false)
    }
  }

  async function restoreNow() {
    const confirmed = window.confirm(
      'Substituir pelos dados da nuvem descarta alteracoes locais ainda nao enviadas. Continuar?'
    )
    if (!confirmed) return
    setStatus(null)
    setLoading(true)
    try {
      const result = await restoreSupabaseDataToLocal('replace')
      await reloadStores()
      const total = result.workouts + result.exercises + result.sessions + result.measurements + result.achievements
      setStatus(`${total} itens restaurados da nuvem.`)
    } catch {
      setStatus('Nao foi possivel restaurar. Os dados locais existentes foram preservados.')
    } finally {
      setLoading(false)
    }
  }

  async function resolveConflicts(strategy: 'local' | 'cloud') {
    const message = strategy === 'local'
      ? 'Manter suas versoes locais e substituir as versoes conflitantes da nuvem?'
      : 'Usar as versoes da nuvem e descartar somente as alteracoes locais conflitantes?'
    if (!window.confirm(message)) return
    setLoading(true)
    try {
      await resolveAllConflicts(strategy)
      await reloadStores()
      setConflicts(await getSyncConflicts())
      setStatus('Conflitos resolvidos e dados sincronizados.')
    } catch {
      setStatus('Nao foi possivel resolver os conflitos agora.')
    } finally {
      setLoading(false)
    }
  }

  async function resolveOneConflict(conflict: SyncConflict, strategy: 'local' | 'cloud') {
    const message = strategy === 'local'
      ? `Manter a versao local de ${conflict.entity}?`
      : `Usar a versao da nuvem para ${conflict.entity}?`
    if (!window.confirm(message)) return
    setLoading(true)
    try {
      await resolveConflict(conflict.id, strategy)
      await reloadStores()
      setConflicts(await getSyncConflicts())
      setStatus('Conflito resolvido e sincronizacao atualizada.')
    } catch {
      setStatus('Nao foi possivel resolver este conflito agora.')
    } finally {
      setLoading(false)
    }
  }

  async function eraseDeviceData() {
    const confirmed = window.confirm(
      'Apagar todos os treinos, historico e medidas deste aparelho? Essa acao nao pode ser desfeita.'
    )
    if (!confirmed) return
    await clearLocalData()
    window.location.reload()
  }

  const user = session?.user
  const name = user?.user_metadata?.full_name as string | undefined
  const email = user?.email

  if (!isSupabaseConfigured) {
    return (
      <Card className="rounded-[var(--radius-lg)] p-5">
        <div className="flex items-center gap-3">
          <div className="icon-chip h-11 w-11 rounded-full" aria-hidden><CloudOff size={19} /></div>
          <div>
            <h2 className="headline text-[var(--foreground)]">Modo local</h2>
            <p className="footnote text-[var(--muted)]">Supabase não configurado. O app continua funcionando offline.</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="rounded-[var(--radius-lg)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="icon-chip h-11 w-11 rounded-full !bg-[var(--accent-soft)] !text-[var(--accent)]" aria-hidden><Cloud size={19} /></div>
          <div className="min-w-0">
            <h2 className="headline text-[var(--foreground)]">Conta na nuvem</h2>
            <p className="footnote truncate text-[var(--muted)]">{email ? name || email : 'Conecte com Google para sincronizar'}</p>
          </div>
        </div>
        {email ? (
          <Button variant="outline" size="sm" onClick={signOut} disabled={loading}><LogOut size={14} aria-hidden />Sair</Button>
        ) : (
          <Button size="sm" onClick={handleSignInWithGoogle} disabled={loading}><LogIn size={14} aria-hidden />Entrar</Button>
        )}
      </div>

      <div role="status" aria-live="polite" className="mt-3 flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--fill)] px-3.5 py-2.5 text-sm text-[var(--muted)]">
        {overview.phase === 'syncing' ? <RefreshCw size={14} className="animate-spin" aria-hidden /> : <Cloud size={14} aria-hidden />}
        <span>{syncLabel(overview)}</span>
      </div>

      {email && (
        <>
          <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--fill)] px-3.5 py-2.5 text-xs text-[var(--muted)]">
            <Mail size={13} aria-hidden /><span className="truncate">{email}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={syncNow} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden />Sincronizar
            </Button>
            <Button variant="outline" size="sm" onClick={restoreNow} disabled={loading}>
              <DownloadCloud size={14} aria-hidden />Restaurar
            </Button>
          </div>
        </>
      )}

      {overview.conflicts > 0 && (
        <div className="mt-3 rounded-2xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[var(--warning-soft)] p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--warning)]">
            <AlertTriangle size={15} aria-hidden />{overview.conflicts} conflitos encontrados
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={() => resolveConflicts('local')} disabled={loading}>Manter local</Button>
            <Button size="sm" variant="outline" onClick={() => resolveConflicts('cloud')} disabled={loading}>Usar nuvem</Button>
          </div>
          <div className="mt-3 space-y-2">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_25%,transparent)] bg-[var(--surface)] p-2.5">
                <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                  {conflict.entity} · {conflict.entityId === 'profile' ? 'perfil' : conflict.entityId}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Local {conflict.localUpdatedAt.toLocaleString('pt-BR')} · Nuvem {conflict.remoteUpdatedAt.toLocaleString('pt-BR')}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" className="min-h-10 rounded-lg bg-[var(--surface-2)] px-2 text-xs font-semibold disabled:opacity-40" onClick={() => resolveOneConflict(conflict, 'local')} disabled={loading}>Este local</button>
                  <button type="button" className="min-h-10 rounded-lg border border-[var(--border)] px-2 text-xs font-semibold disabled:opacity-40" onClick={() => resolveOneConflict(conflict, 'cloud')} disabled={loading}>Este da nuvem</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={eraseDeviceData}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]">
        <Trash2 size={15} aria-hidden />Apagar dados deste aparelho
      </button>
      {status && <p role="status" aria-live="polite" className="mt-3 rounded-[var(--radius-sm)] bg-[var(--fill)] px-3.5 py-2.5 text-sm text-[var(--muted)]">{status}</p>}
    </Card>
  )
}
