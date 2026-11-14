'use client'

import { useMemo } from 'react'
import { subDays } from 'date-fns'
import { LineChart } from '@/components/insights/LineChart'
import { formatWeeklyRate, summarizeWeightTrend, type WeightPoint } from '@/lib/weightTrend'
import { formatDecimal } from '@/lib/utils'

/** Body weight: latest reading, 10-day smoothed trend over the raw points, weekly rate. */
export function WeightTrendTile({ points, className }: { points: WeightPoint[]; className?: string }) {
  const summary = useMemo(() => summarizeWeightTrend(points), [points])
  const latest = points.at(-1)
  // Chart the last 120 days (the trend is computed from the full history).
  const visible = useMemo(() => {
    const last = points.at(-1)
    if (!last) return { raw: [], smooth: [] }
    const from = subDays(last.date, 120)
    return {
      raw: points.filter((point) => point.date >= from).slice(-60),
      smooth: summary.trend.filter((point) => point.date >= from),
    }
  }, [points, summary.trend])
  if (!latest) return null
  const rateTone = summary.direction == null || summary.direction === 'stable' ? 'text-[var(--muted)]' : 'text-[var(--foreground)]'

  return (
    <div className={className ?? 'tile'}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="subhead text-[var(--muted)]">Peso</p>
          <p className="stat text-[40px]">{formatDecimal(latest.value)}<span className="stat-unit">kg</span></p>
        </div>
        {summary.rate != null && (
          <p className={`subhead numeric text-right font-semibold ${rateTone}`}>
            {formatWeeklyRate(summary.rate)}
            {summary.current != null && <span className="footnote block font-normal text-[var(--muted)]">Tendência {formatDecimal(Math.round(summary.current * 10) / 10)} kg</span>}
          </p>
        )}
      </div>
      {visible.raw.length >= 2 && (
        <div className="mt-4">
          <LineChart
            points={visible.raw}
            smoothed={visible.smooth.length >= 2 ? visible.smooth : null}
            height={120}
            format={(value) => `${formatDecimal(Math.round(value * 10) / 10)} kg`}
            label={`Evolução do peso: ${visible.raw.length} registros, de ${formatDecimal(visible.raw[0].value)} kg a ${formatDecimal(latest.value)} kg.${summary.text ? ` ${summary.text}` : ''}`}
          />
          <div aria-hidden className="caption mt-2 flex items-center gap-4 text-[var(--muted)]">
            <span className="flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded-full bg-[var(--data-1)]" />Tendência (10 dias)</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--muted)] opacity-60" />Pesagens</span>
          </div>
        </div>
      )}
      {summary.text && <p className="footnote mt-3 text-[var(--muted)]">{summary.text}</p>}
    </div>
  )
}
