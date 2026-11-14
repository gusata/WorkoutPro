'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'
import { endOfWeek, format, startOfWeek, subWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Hero, LocalNav, SectionHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { MiniBars } from '@/components/health/charts'
import { CardioDetail, CardioForm } from '@/components/health/CardioSheets'
import { LiveCardio } from '@/components/health/LiveCardio'
import { useCardioStore } from '@/stores/useCardioStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { cardioLabel, DEFAULT_CARDIO_GOAL, formatDistance, formatMinutes, formatPace, maxHeartRate, ZONES } from '@/lib/cardio'
import type { CardioSession } from '@/types'

export default function CardioPage() {
  const sessions = useCardioStore((state) => state.sessions)
  const preferences = useProfileStore((state) => state.profile?.preferences)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CardioSession | null>(null)
  const [selected, setSelected] = useState<CardioSession | null>(null)
  const [now] = useState(() => new Date())
  const goal = preferences?.weeklyGoals?.cardioMinutes ?? DEFAULT_CARDIO_GOAL
  const maxHr = maxHeartRate(preferences)

  const weeks = useMemo(() => Array.from({ length: 8 }, (_, index) => {
    const start = startOfWeek(subWeeks(now, 7 - index), { weekStartsOn: 1 })
    const end = endOfWeek(start, { weekStartsOn: 1 })
    const items = sessions.filter((item) => new Date(item.startedAt) >= start && new Date(item.startedAt) <= end)
    return {
      start,
      minutes: Math.round(items.reduce((total, item) => total + item.duration, 0) / 60),
      distance: items.reduce((total, item) => total + (item.distance ?? 0), 0),
      items,
    }
  }), [now, sessions])
  const thisWeek = weeks.at(-1)!
  const zoneTotals = useMemo(() => {
    const totals = [0, 0, 0, 0, 0]
    for (const item of weeks.slice(-4).flatMap((week) => week.items)) item.zones?.forEach((seconds, index) => { totals[index] += seconds })
    return totals
  }, [weeks])
  const zoneSum = zoneTotals.reduce((a, b) => a + b, 0)
  const easyShare = zoneSum ? Math.round(((zoneTotals[0] + zoneTotals[1]) / zoneSum) * 100) : null

  const grouped = useMemo(() => {
    const map = new Map<string, CardioSession[]>()
    for (const item of sessions) {
      const key = format(startOfWeek(new Date(item.startedAt), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.entries()]
  }, [sessions])

  return (
    <div className="apple-page page-content">
      <LocalNav title="Cardio" back="/health" actions={<button type="button" onClick={() => { setEditing(null); setFormOpen(true) }} className="pill"><Plus size={14} strokeWidth={2.4} aria-hidden />Registrar</button>} />
      <Hero
        eyebrow="Condicionamento"
        title="Cardio."
        lede={`${thisWeek.minutes} de ${goal} minutos nesta semana${thisWeek.distance > 0 ? ` · ${formatDistance(thisWeek.distance)}` : ''}.`}
      />

      <LiveCardio onSaved={setSelected} />

      <section className="tile mt-8" aria-label="Minutos por semana">
        <p className="subhead text-[var(--muted)]">Minutos por semana</p>
        <div className="mt-4">
          <MiniBars data={weeks.map((week) => ({ label: format(week.start, 'd/M'), value: week.minutes }))} goal={goal} format={(value) => `${value} min`} height={120} />
        </div>
        <p className="footnote mt-3 text-[var(--muted)]">Linha tracejada: sua meta de {goal} min. <Link href="/settings#metas" className="text-[var(--accent)]">Alterar</Link></p>
      </section>

      <section className="stack-section" aria-labelledby="zones-title">
        <SectionHeader id="zones-title" title="Zonas." subtitle="Tempo em cada zona de frequência cardíaca, últimas 4 semanas." />
        <div className="tile">
          {zoneSum > 0 ? (
            <>
              <div className="flex h-4 overflow-hidden rounded-full" aria-hidden>
                {zoneTotals.map((seconds, index) => seconds > 0 && <span key={index} style={{ width: `${(seconds / zoneSum) * 100}%`, background: ZONES[index].color }} />)}
              </div>
              <ul className="mt-5 space-y-2.5">
                {ZONES.map((zone, index) => (
                  <li key={zone.label} className="flex items-center gap-3">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: zone.color }} />
                    <span className="subhead flex-1">{zone.label} · {zone.name}</span>
                    <span className="subhead numeric font-semibold">{formatMinutes(zoneTotals[index])}</span>
                  </li>
                ))}
              </ul>
              {easyShare != null && (
                <p className="footnote mt-4 text-[var(--muted)]">
                  {easyShare}% do tempo em zonas leves (1 e 2). Atletas de resistência costumam manter cerca de 80% do volume nessas zonas.
                </p>
              )}
            </>
          ) : maxHr ? (
            <p className="subhead text-[var(--muted)]">As zonas aparecem nos treinos importados do relógio que registraram frequência cardíaca.</p>
          ) : (
            <p className="subhead text-[var(--muted)]">
              Informe seu ano de nascimento em <Link href="/settings#coracao" className="text-[var(--accent)]">Ajustes</Link> para calcular suas zonas de frequência cardíaca.
            </p>
          )}
        </div>
      </section>

      <section className="stack-section" aria-labelledby="history-title">
        <SectionHeader id="history-title" title="Histórico." />
        {grouped.length === 0 ? (
          <div className="tile text-center">
            <p className="headline">Nenhum cardio ainda</p>
            <p className="footnote mt-1 text-[var(--muted)]">Registre à mão ou conecte o relógio em Saúde para importar corridas, pedaladas e caminhadas.</p>
            <Button className="mt-5" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus size={16} aria-hidden />Registrar cardio</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([week, items]) => (
              <div key={week}>
                <p className="list-header">Semana de {format(new Date(`${week}T12:00:00`), "d 'de' MMM", { locale: ptBR })} · {formatMinutes(items.reduce((total, item) => total + item.duration, 0))}</p>
                <ul className="list">
                  {items.map((item) => {
                    const pace = formatPace(item.duration, item.distance)
                    return (
                      <li key={item.id}>
                        <button type="button" onClick={() => setSelected(item)} className="grouped-row flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left">
                          <span className="min-w-0 flex-1">
                            <span className="headline block">{cardioLabel(item.activity)}</span>
                            <span className="footnote text-[var(--muted)]">
                              {format(new Date(item.startedAt), "EEE, d 'de' MMM · HH:mm", { locale: ptBR })}
                              {item.avgHeartRate ? ` · ${item.avgHeartRate} bpm` : ''}{pace ? ` · ${pace}` : ''}
                            </span>
                          </span>
                          <span className="text-right">
                            <span className="stat block text-[18px]">{item.distance ? formatDistance(item.distance) : formatMinutes(item.duration)}</span>
                            {item.distance ? <span className="footnote text-[var(--muted)]">{formatMinutes(item.duration)}</span> : null}
                          </span>
                          <ChevronRight size={17} className="flex-none text-[var(--muted)]" aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <CardioForm open={formOpen} initial={editing} onClose={() => { setFormOpen(false); setEditing(null) }} />
      <CardioDetail session={selected} onClose={() => setSelected(null)} onEdit={(item) => { setSelected(null); setEditing(item); setFormOpen(true) }} />
    </div>
  )
}
