'use client'

import { useEffect, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { clearLocalErrorLog, getLocalErrorLog, type LocalErrorRecord } from '@/lib/observability'

export function DiagnosticsCard() {
  const [records, setRecords] = useState<LocalErrorRecord[]>([])

  useEffect(() => {
    const refresh = () => setRecords(getLocalErrorLog())
    refresh()
    window.addEventListener('workoutpro:error-recorded', refresh)
    return () => window.removeEventListener('workoutpro:error-recorded', refresh)
  }, [])

  function exportDiagnostics() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'workoutpro-diagnostico.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="rounded-[var(--radius-xl)] p-6">
      <h2 className="title-3 text-[var(--foreground)]">Diagnóstico local</h2>
      <p className="subhead mt-1 text-[var(--muted)]">
        {records.length === 0 ? 'Nenhuma falha tecnica registrada neste aparelho.' : `${records.length} registros tecnicos locais, sem stack trace ou dados de treino.`}
      </p>
      {records.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={exportDiagnostics}><Download size={14} />Exportar</Button>
          <Button size="sm" variant="secondary" onClick={() => { clearLocalErrorLog(); setRecords([]) }}><Trash2 size={14} />Limpar</Button>
        </div>
      )}
    </Card>
  )
}
