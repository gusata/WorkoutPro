'use client'

import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Hero, LocalNav, SectionHeader } from '@/components/layout/PageHeader'
import { Hypnogram, MiniBars, StageLegend, formatHm } from '@/components/health/charts'
import { useHealthStore } from '@/stores/useHealthStore'
import type { SleepNight } from '@/lib/health'

const TARGET = 450

function minutesOfDay(date: Date, wrapBefore = 12) {
  // Bedtimes after midnight count as 24h+ so averages don't jump around midnight.
  const minutes = date.getHours() * 60 + date.getMinutes()
  return date.getHours() < wrapBefore ? minutes + 24 * 60 : minutes
}

function clock(minutes: number) {
  const value = Math.round(minutes) % (24 * 60)
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export default function SleepPage() {
  const sleep = useHealthStore((state) => state.sleep)
  const [now] = useState(() => new Date())
  const nights = useMemo(() => [...sleep].sort((a, b) => b.end.getTime() - a.end.getTime()), [sleep])
  const week = nights.filter((night) => night.end >= subDays(now, 7))

  const stats = useMemo(() => {
    if (week.length === 0) return null
    const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
    const staged = week.filter((night) => night.hasStages && night.asleep > 0)
    const bedtimes = week.map((night) => minutesOfDay(night.start))
    const meanBed = avg(bedtimes)
    const spread = Math.sqrt(avg(bedtimes.map((value) => (value - meanBed) ** 2)))
    return {
      asleep: Math.round(avg(week.map((night) => night.asleep))),
      deepPct: staged.length ? Math.round(avg(staged.map((night) => night.minutes.deep / night.asleep)) * 100) : null,
      remPct: staged.length ? Math.round(avg(staged.map((night) => night.minutes.rem / night.asleep)) * 100) : null,
      bedtime: clock(meanBed),
      wake: clock(avg(week.map((night) => minutesOfDay(night.end, 0)))),
      regularity: Math.round(spread),
      onTarget: week.filter((night) => night.asleep >= TARGET).length,
    }
  }, [week])

  const lede = !stats
    ? 'Conecte o relógio em Saúde para ver suas noites.'
    : stats.asleep >= TARGET
      ? `Média de ${formatHm(stats.asleep)} por noite. Ótimo para recuperar.`
      : `Média de ${formatHm(stats.asleep)} por noite, abaixo das 7h30 recomendadas para quem treina.`

  return (
    <div className="apple-page page-content">
      <LocalNav title="Sono" back="/health" />
      <Hero eyebrow="Últimos 7 dias" title="Sono." lede={lede} />

      {stats && (
        <>
          <section className="tile mt-8" aria-label="Noites da semana">
            <MiniBars
              data={[...week].reverse().map((night) => ({ label: format(night.end, 'EEEEE', { locale: ptBR }), value: night.asleep }))}
              goal={TARGET}
              format={formatHm}
              height={120}
            />
            <p className="footnote mt-3 text-[var(--muted)]">Linha tracejada: meta de 7h30. {stats.onTarget} de {week.length} noites atingiram a meta.</p>
          </section>

          <section className="tile mt-3 grid grid-cols-2 gap-x-4 gap-y-6" aria-label="Médias">
            {[
              ['Hora de dormir', stats.bedtime],
              ['Hora de acordar', stats.wake],
              ['Sono profundo', stats.deepPct != null ? `${stats.deepPct}%` : '—'],
              ['REM', stats.remPct != null ? `${stats.remPct}%` : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="footnote text-[var(--muted)]">{label}</p>
                <p className="stat mt-1 text-[28px]">{value}</p>
              </div>
            ))}
            <p className="footnote col-span-2 text-[var(--muted)]">
              {stats.regularity <= 30
                ? 'Horários regulares: você dorme em horários parecidos todos os dias.'
                : `Seus horários variam cerca de ${stats.regularity} min. Regularidade ajuda a recuperação.`}
              {' '}Adultos costumam ter 13–23% de sono profundo e 20–25% de REM.
            </p>
          </section>
        </>
      )}

      {nights.length > 0 && (
        <section className="stack-section" aria-labelledby="nights-title">
          <SectionHeader id="nights-title" title="Noites." />
          <ul className="space-y-3">
            {nights.map((night) => <NightTile key={night.start.toISOString()} night={night} />)}
          </ul>
        </section>
      )}
    </div>
  )
}

function NightTile({ night }: { night: SleepNight }) {
  return (
    <li className="tile">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="subhead text-[var(--muted)]">{format(night.end, "EEEE, d 'de' MMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())}</p>
          <p className="stat mt-1 text-[30px]">{formatHm(night.asleep)}</p>
        </div>
        <p className="footnote text-right text-[var(--muted)]">{format(night.start, 'HH:mm')} – {format(night.end, 'HH:mm')}<br />{night.sourceName ?? ''}</p>
      </div>
      <div className="mt-4"><Hypnogram night={night} compact /></div>
      <div className="mt-4"><StageLegend night={night} /></div>
    </li>
  )
}
