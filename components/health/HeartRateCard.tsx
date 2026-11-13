'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Heart } from 'lucide-react'
import { format, formatDistanceStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { HeartDay, HeartToday } from '@/lib/health'

/** "agora", "há 4 min"... re-rendered every 30 s so the age stays honest. */
function useAge(time: Date | null | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  if (!time) return null
  if (now - time.getTime() < 90_000) return 'agora'
  return `há ${formatDistanceStrict(time, now, { locale: ptBR })}`
}

/** Today's heart rate: 5-minute averages with the min–max band, over a 24 h axis. */
function DayChart({ today }: { today: HeartToday }) {
  const width = 320
  const height = 120
  const pad = 6
  const dayStart = new Date(today.points[0].time)
  dayStart.setHours(0, 0, 0, 0)
  const lo = Math.max(30, Math.min(...today.points.map((point) => point.min)) - 8)
  const hi = Math.max(...today.points.map((point) => point.max)) + 8
  const x = (time: Date) => ((time.getTime() - dayStart.getTime()) / 86_400_000) * width
  const y = (bpm: number) => pad + (1 - (bpm - lo) / (hi - lo)) * (height - pad * 2)
  // Break the line where the watch did not record for more than 30 minutes.
  const segments: Array<typeof today.points> = []
  for (const point of today.points) {
    const current = segments.at(-1)
    const previous = current?.at(-1)
    if (current && previous && point.time.getTime() - previous.time.getTime() <= 30 * 60_000) current.push(point)
    else segments.push([point])
  }
  return (
    <figure>
      <figcaption className="sr-only">
        Frequência cardíaca de hoje: mínima {today.min}, média {today.avg} e máxima {today.max} batimentos por minuto.
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" aria-hidden>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1={ratio * width} x2={ratio * width} y1={0} y2={height} stroke="var(--separator)" strokeWidth={0.5} />
        ))}
        {today.points.map((point) => (
          <line key={point.time.getTime()} x1={x(point.time)} x2={x(point.time)} y1={y(point.max)} y2={y(point.min)} stroke="#ff375f" strokeOpacity={0.28} strokeWidth={2.5} strokeLinecap="round" />
        ))}
        {segments.map((segment, index) => (
          <path
            key={index}
            d={segment.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.time).toFixed(1)},${y(point.avg).toFixed(1)}`).join(' ')}
            fill="none" stroke="#ff375f" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round"
          />
        ))}
        {today.latest && <circle cx={x(today.latest.time)} cy={y(today.latest.bpm)} r={4.5} fill="#ff375f" stroke="var(--surface)" strokeWidth={2} />}
      </svg>
      <div aria-hidden className="caption mt-1.5 flex justify-between text-[var(--muted)]">
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span>
      </div>
    </figure>
  )
}

/** Last days as min–max range bars with the daily average marked. */
function WeekRanges({ days }: { days: HeartDay[] }) {
  const lo = Math.min(...days.map((day) => day.min)) - 5
  const hi = Math.max(...days.map((day) => day.max)) + 5
  const pct = (bpm: number) => ((bpm - lo) / (hi - lo)) * 100
  return (
    <figure>
      <figcaption className="sr-only">{days.map((day) => `${format(day.date, 'EEEE', { locale: ptBR })}: ${day.min} a ${day.max} bpm, média ${day.avg}`).join('; ')}</figcaption>
      <div aria-hidden className="grid h-28 items-stretch gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((day) => (
          <div key={day.date.toISOString()} className="relative flex justify-center">
            <span className="absolute w-2 rounded-full bg-[#ff375f]/30" style={{ bottom: `${pct(day.min)}%`, top: `${100 - pct(day.max)}%` }} />
            <span className="absolute h-2 w-2 rounded-full bg-[#ff375f]" style={{ bottom: `calc(${pct(day.avg)}% - 4px)` }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((day) => <span key={day.date.toISOString()} className="caption text-center text-[var(--muted)]">{format(day.date, 'EEEEE', { locale: ptBR })}</span>)}
      </div>
    </figure>
  )
}

export function HeartRateCard({ today, days, resting }: { today: HeartToday | null; days: HeartDay[]; resting: number | null }) {
  const age = useAge(today?.latest?.time)
  if (!today?.latest && days.length === 0) return null
  return (
    <div className="tile">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="subhead flex items-center gap-1.5 text-[var(--muted)]"><Heart size={15} fill="#ff375f" className="text-[#ff375f]" aria-hidden />Última medição</p>
          {today?.latest ? (
            <p className="stat mt-1 text-[44px]" aria-live="polite">{today.latest.bpm}<span className="stat-unit">bpm</span></p>
          ) : (
            <p className="stat mt-1 text-[44px] text-[var(--muted)]">—</p>
          )}
          {age && today?.latest && <p className="footnote text-[var(--muted)]">{age} · {format(today.latest.time, 'HH:mm')}</p>}
        </div>
        {today?.latest && (
          <dl className="grid grid-cols-3 gap-4 text-right">
            {[['Mín.', today.min], ['Média', today.avg], ['Máx.', today.max]].map(([label, value]) => (
              <div key={label as string}>
                <dt className="caption text-[var(--muted)]">{label}</dt>
                <dd className="headline numeric">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {today && today.points.length > 1 && <div className="mt-5"><DayChart today={today} /></div>}
      {days.length > 1 && (
        <div className="mt-6 border-t border-[var(--separator)] pt-5">
          <p className="subhead mb-3 text-[var(--muted)]">Últimos {days.length} dias{resting ? ` · repouso ${resting} bpm` : ''}</p>
          <WeekRanges days={days} />
        </div>
      )}
    </div>
  )
}

/** Compact line for the Hoje tab. */
export function HeartRateChip({ today, steps }: { today: HeartToday | null; steps: number | null }) {
  const age = useAge(today?.latest?.time)
  if (!today?.latest && steps == null) return null
  return (
    <Link href="/health" className="tile tile-compact tile-link mt-3 flex items-center gap-4" aria-label={`${today?.latest ? `Frequência cardíaca ${today.latest.bpm} bpm, ${age}. ` : ''}${steps != null ? `${steps} passos hoje. ` : ''}Abrir Saúde`}>
      {today?.latest && (
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Heart size={22} fill="#ff375f" className="flex-none text-[#ff375f]" aria-hidden />
          <span>
            <span className="stat block text-[26px]">{today.latest.bpm}<span className="stat-unit">bpm</span></span>
            <span className="footnote text-[var(--muted)]">{age}</span>
          </span>
        </span>
      )}
      {steps != null && (
        <span className="flex-1">
          <span className="stat block text-[26px]">{steps.toLocaleString('pt-BR')}</span>
          <span className="footnote text-[var(--muted)]">passos hoje</span>
        </span>
      )}
      <ChevronRight size={18} className="flex-none text-[var(--muted)]" aria-hidden />
    </Link>
  )
}
