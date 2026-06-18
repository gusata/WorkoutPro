'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Clock, Weight, Calendar } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  Area, AreaChart, CartesianGrid
} from 'recharts'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { Card } from '@/components/ui/Card'
import { formatVolume, formatDuration } from '@/lib/utils'
import {
  format, startOfWeek, subWeeks, eachDayOfInterval,
  startOfMonth, endOfMonth, subMonths, getDay,
  isWithinInterval, endOfWeek
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Period = 'week' | 'month' | 'year'

const GREEN  = '#00c896'
const INDIGO = '#6366f1'
const AMBER  = '#f59e0b'

function StatChip({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} style={{ color }} />
        <span className="text-[11px] text-zinc-500 font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-white tracking-tight">{value}</p>
    </Card>
  )
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string
}) {
  if (active && payload?.length) {
    return (
      <div className="rounded-xl px-3 py-2 text-xs"
        style={{ background: '#17171b', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <p className="text-zinc-400 mb-0.5">{label}</p>
        <p className="font-bold text-white">{formatVolume(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

function FreqTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string
}) {
  if (active && payload?.length) {
    return (
      <div className="rounded-xl px-3 py-2 text-xs"
        style={{ background: '#17171b', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <p className="text-zinc-400 mb-0.5">{label}</p>
        <p className="font-bold text-white">{payload[0].value} treino{payload[0].value !== 1 ? 's' : ''}</p>
      </div>
    )
  }
  return null
}

export default function StatsPage() {
  const { sessions } = useProfileStore()
  const [period, setPeriod] = useState<Period>('week')

  const filteredSessions = useMemo(() => {
    const now = new Date()
    if (period === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 })
      return sessions.filter((s) => s.finishedAt && new Date(s.finishedAt) >= start)
    }
    if (period === 'month') {
      return sessions.filter((s) => s.finishedAt && new Date(s.finishedAt) >= subMonths(now, 1))
    }
    return sessions.filter((s) => s.finishedAt && new Date(s.finishedAt) >= subMonths(now, 12))
  }, [sessions, period])

  const totalVolume = filteredSessions.reduce((a, s) => a + s.totalVolume, 0)
  const totalTime   = filteredSessions.reduce((a, s) => a + s.duration, 0)

  const volumeChartData = useMemo(() => {
    const now = new Date()
    if (period === 'week') {
      const days = eachDayOfInterval({
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      })
      return days.map((d) => ({
        day: format(d, 'EEE', { locale: ptBR }),
        volume: sessions
          .filter((s) => s.finishedAt &&
            format(new Date(s.finishedAt), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd'))
          .reduce((a, s) => a + s.totalVolume, 0),
      }))
    }
    if (period === 'month') {
      return Array.from({ length: 4 }, (_, i) => {
        const weekStart = subWeeks(now, 3 - i)
        const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 1 })
        return {
          day: `Sem ${i + 1}`,
          volume: sessions
            .filter((s) => s.finishedAt && isWithinInterval(new Date(s.finishedAt), { start: weekStart, end: weekEnd }))
            .reduce((a, s) => a + s.totalVolume, 0),
        }
      })
    }
    return Array.from({ length: 12 }, (_, i) => {
      const monthDate = subMonths(now, 11 - i)
      const start = startOfMonth(monthDate)
      const end   = endOfMonth(monthDate)
      return {
        day: format(monthDate, 'MMM', { locale: ptBR }),
        volume: sessions
          .filter((s) => s.finishedAt && isWithinInterval(new Date(s.finishedAt), { start, end }))
          .reduce((a, s) => a + s.totalVolume, 0),
      }
    })
  }, [sessions, period])

  const heatmapData = useMemo(() => {
    const now = new Date()
    const start = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 51)
    const days = eachDayOfInterval({ start, end: now })
    const dayCounts: Record<string, number> = {}
    sessions.forEach((s) => {
      if (s.finishedAt) {
        const key = format(new Date(s.finishedAt), 'yyyy-MM-dd')
        dayCounts[key] = (dayCounts[key] ?? 0) + 1
      }
    })
    return days.map((d) => ({
      date: d,
      key: format(d, 'yyyy-MM-dd'),
      count: dayCounts[format(d, 'yyyy-MM-dd')] ?? 0,
      weekDay: getDay(d),
    }))
  }, [sessions])

  const heatmapWeeks = useMemo(() => {
    const weeks: typeof heatmapData[] = []
    let week: typeof heatmapData = []
    heatmapData.forEach((d) => {
      if (d.weekDay === 1 && week.length > 0) { weeks.push(week); week = [] }
      week.push(d)
    })
    if (week.length > 0) weeks.push(week)
    return weeks
  }, [heatmapData])

  const freqData = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => {
      const weekStart = subWeeks(new Date(), 7 - i)
      const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 1 })
      return {
        week: `S${i + 1}`,
        treinos: sessions.filter((s) =>
          s.finishedAt && isWithinInterval(new Date(s.finishedAt), { start: weekStart, end: weekEnd })
        ).length,
      }
    }), [sessions])

  const PERIODS: { value: Period; label: string }[] = [
    { value: 'week',  label: 'Semana' },
    { value: 'month', label: 'Mês'    },
    { value: 'year',  label: 'Ano'    },
  ]

  const axisProps = {
    tick: { fill: '#52525b', fontSize: 11 },
    axisLine: false as const,
    tickLine: false as const,
  }

  return (
    <div className="px-4 pt-14 pb-4 page-content max-w-lg mx-auto space-y-5">
      <div>
        <p className="text-xs text-zinc-500">Suas</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">Estatísticas</h1>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 p-1 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              period === p.value
                ? { background: GREEN, color: '#080809' }
                : { color: '#71717a' }
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatChip icon={BarChart3} label="Treinos" value={`${filteredSessions.length}`}  color={INDIGO} />
        <StatChip icon={Weight}    label="Volume"  value={formatVolume(totalVolume)}     color={GREEN}  />
        <StatChip icon={Clock}     label="Tempo"   value={formatDuration(totalTime)}     color={AMBER}  />
      </div>

      {/* Volume bar chart */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} style={{ color: GREEN }} />
          <p className="text-sm font-semibold text-white">Volume por período</p>
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={volumeChartData} barSize={18}>
            <XAxis dataKey="day" {...axisProps} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="volume" fill={GREEN} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Frequency area chart */}
      {sessions.length >= 3 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={14} style={{ color: INDIGO }} />
            <p className="text-sm font-semibold text-white">Frequência semanal</p>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={freqData}>
              <defs>
                <linearGradient id="freqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={INDIGO} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={INDIGO} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" {...axisProps} />
              <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
              <Tooltip content={<FreqTooltip />} />
              <Area
                type="monotone"
                dataKey="treinos"
                stroke={INDIGO}
                fill="url(#freqGrad)"
                strokeWidth={2}
                dot={{ fill: INDIGO, r: 3, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Activity heatmap */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={14} style={{ color: GREEN }} />
          <p className="text-sm font-semibold text-white">Atividade anual</p>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-[3px] min-w-max">
            {heatmapWeeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const day = week.find((d) => d.weekDay === (dayIdx + 1) % 7)
                  const count = day?.count ?? 0
                  return (
                    <div
                      key={dayIdx}
                      className="w-[11px] h-[11px] rounded-[3px]"
                      style={{
                        background:
                          count === 0 ? 'rgba(255,255,255,0.04)'
                          : count === 1 ? 'rgba(0,200,150,0.3)'
                          : count === 2 ? 'rgba(0,200,150,0.55)'
                          : 'rgba(0,200,150,0.85)',
                      }}
                      title={day ? `${format(day.date, 'dd/MM')} — ${count} treino(s)` : ''}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 text-[11px] text-zinc-600">
          <span>Menos</span>
          {[0, 1, 2, 3].map((v) => (
            <div key={v} className="w-[11px] h-[11px] rounded-[3px]" style={{
              background: v === 0 ? 'rgba(255,255,255,0.04)'
                : v === 1 ? 'rgba(0,200,150,0.3)'
                : v === 2 ? 'rgba(0,200,150,0.55)'
                : 'rgba(0,200,150,0.85)',
            }} />
          ))}
          <span>Mais</span>
        </div>
      </Card>

      {/* All-time stats */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-white mb-3">Todos os tempos</p>
        <div className="space-y-0">
          {[
            { label: 'Total de treinos',  value: `${sessions.length}` },
            { label: 'Volume total',      value: formatVolume(sessions.reduce((a, s) => a + s.totalVolume, 0)) },
            { label: 'Tempo total',       value: formatDuration(sessions.reduce((a, s) => a + s.duration, 0)) },
            { label: 'Média por treino',  value: sessions.length > 0
                ? formatVolume(sessions.reduce((a, s) => a + s.totalVolume, 0) / sessions.length)
                : '—' },
          ].map((item) => (
            <div key={item.label}
              className="flex justify-between items-center py-2.5 border-b last:border-0"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}
            >
              <span className="text-sm text-zinc-400">{item.label}</span>
              <span className="text-sm font-bold text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
