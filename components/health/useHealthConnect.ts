'use client'

import { useEffect, useState } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useHealthStore } from '@/stores/useHealthStore'

/** Availability + connect/disconnect flow shared by Ajustes and the Saúde tab. */
export function useHealthConnect() {
  const healthSync = useProfileStore((state) => state.profile?.preferences?.healthSync ?? false)
  const updatePreferences = useProfileStore((state) => state.updatePreferences)
  const importHealthMeasurements = useProfileStore((state) => state.importHealthMeasurements)
  const refresh = useHealthStore((state) => state.refresh)
  const [availability, setAvailability] = useState<{ available: boolean; reason?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('@/lib/health').then(({ healthAvailable }) => healthAvailable()).then((result) => { if (!cancelled) setAvailability(result) })
    return () => { cancelled = true }
  }, [])

  async function connect() {
    setBusy(true)
    setMessage(null)
    try {
      const { connectHealth } = await import('@/lib/health')
      const granted = await connectHealth()
      if (!granted) {
        setMessage('Acesso negado. Libere nas permissões do Health Connect.')
        return false
      }
      await updatePreferences({ healthSync: true })
      const added = await importHealthMeasurements()
      const result = await refresh({ force: true })
      const parts = [
        added > 0 ? `${added} ${added === 1 ? 'medida importada' : 'medidas importadas'}` : null,
        result?.imported ? `${result.imported} ${result.imported === 1 ? 'treino de cardio' : 'treinos de cardio'}` : null,
      ].filter(Boolean)
      setMessage(parts.length ? `Conectado: ${parts.join(' e ')}.` : 'Conectado. Seus dados aparecem conforme o relógio sincroniza.')
      return true
    } catch {
      setMessage('Não foi possível conectar agora.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    await updatePreferences({ healthSync: false })
    setMessage(null)
  }

  async function openSettings() {
    const { openHealthSettings } = await import('@/lib/health')
    await openHealthSettings().catch(() => setMessage('Não foi possível abrir o Health Connect.'))
  }

  return { healthSync, availability, busy, message, connect, disconnect, openSettings, setMessage }
}
