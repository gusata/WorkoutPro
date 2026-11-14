'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus, RefreshCw } from 'lucide-react'
import { format, formatDistanceToNow, isToday, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Hero, LocalNav, SectionHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { LineChart } from '@/components/insights/LineChart'
import { Hypnogram, MiniBars, ScoreRing, StageLegend, formatHm } from '@/components/health/charts'
import { CardioDetail, CardioForm } from '@/components/health/CardioSheets'
import { useHealthConnect } from '@/components/health/useHealthConnect'
import { HeartRateCard } from '@/components/health/HeartRateCard'
import { useHealthStore } from '@/stores/useHealthStore'
import { useCardioStore } from '@/stores/useCardioStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { computeReadiness } from '@/lib/readiness'
import { cardioLabel, cardioMinutesInWeek, DEFAULT_CARDIO_GOAL, formatDistance, formatMinutes } from '@/lib/cardio'
import { trendPer30Days } from '@/lib/insights'
import { formatDecimal } from '@/lib/utils'
import type { CardioSession } from '@/types'

export default function HealthPage() {
  const health = useHealthStore()
  const cardio = useCardioStore((state) => state.sessions)
  const profile = useProfileStore((state) => state.profile)
  const sessions = useProfileStore((state) => state.sessions)
  const connect = useHealthConnect()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CardioSession | null>(null)
  const [selected, setSelected] = useState<CardioSession | null>(null)
  const [now] = useState(() => new Date())

  const lastNight = health.sleep.at(-1) ?? null
  const recentSets = useMemo(() => sessions
    .filter((session) => session.finishedAt && now.getTime() - new Date(session.finishedAt).getTime() < 86_400_000)
    .reduce((total, session) => total + session.exercises.reduce((sum, item) => sum + item.sets.filter((set) => (set.setType ?? 'normal') !== 'warmup').length, 0), 0), [now, sessions])
  const readiness = useMemo(() => computeReadiness({
    hrv: health.hrv,
    restingHr: health.restingHr,
    sleep: lastNight ? { asleep: lastNight.asleep, deep: lastNight.minutes.deep, rem: lastNight.minutes.rem, hasStages: lastNight.hasStages, end: lastNight.end } : null,
    recentSets,
    now,
  }), [health.hrv, health.restingHr, lastNight, now, recentSets])

  const cardioGoal = profile?.preferences?.weeklyGoals?.cardioMinutes ?? DEFAULT_CARDIO_GOAL
  const cardioMinutes = cardioMinutesInWeek(cardio, now)
  const weekSleep = health.sleep.filter((night) => night.end >= subDays(now, 7))
  const avgSleep = weekSleep.length ? Math.round(weekSleep.reduce((total, night) => total + night.asleep, 0) / weekSleep.length) : null
  const todaySteps = health.steps.find((day) => isToday(day.date))?.value ?? null

  const connected = connect.healthSync && connect.availability?.available
  const lede = readiness ? readiness.headline : connected ? 'Sono, coração e cardio do seu relógio.' : 'Conecte seu relógio para ver sono, coração e prontidão.'

  async function refresh() {
    const result = await health.refresh({ force: true })
    if (result?.imported) connect.setMessage(`${result.imported} ${result.imported === 1 ? 'novo treino de cardio importado' : 'novos treinos de cardio importados'}.`)
  }

  return (
    <div className="apple-page page-content">
      <LocalNav
        title="Saúde"
        actions={<button type="button" onClick={() => { setEditing(null); setFormOpen(true) }} className="pill"><Plus size={14} strokeWidth={2.4} aria-hidden />Cardio</button>}
      />
      <Hero eyebrow="Recuperação e condicionamento" title="Saúde." lede={lede} />

      {!connect.healthSync && (
        <section className="tile tile-dark mt-8 text-center" aria-labelledby="connect-title">
          <p className="eyebrow !text-[#ff8a3d]">Galaxy Watch, Samsung Health e outros</p>
          <h2 id="connect-title" className="title-1 mt-1 text-[#f5f5f7]">Traga os dados do seu relógio.</h2>
          <p className="subhead mx-auto mt-3 max-w-sm text-[#a1a1a6]">
            O app lê sono, frequência cardíaca, HRV, VO2 máx, passos e treinos de cardio pelo Health Connect, onde o Samsung Health já publica os dados.
          </p>
          {connect.availability?.available ? (
            <Button className="mt-6" onClick={connect.connect} disabled={connect.busy}>{connect.busy ? 'Conectando...' : 'Conectar'}</Button>
          ) : (
            <p className="footnote mt-6 text-[#a1a1a6]">{connect.availability?.reason ?? 'Verificando...'}</p>
          )}
        </section>
      )}

      {connect.healthSync && health.missing.length > 0 && connect.availability?.available && (
        <section className="tile tile-compact mt-6 flex items-center gap-4" aria-label="Permissões">
          <p className="subhead flex-1">Faltam permissões para {health.missing.length} tipo{health.missing.length > 1 ? 's' : ''} de dado (como sono, treinos ou gravar seus treinos).</p>
          <Button size="sm" onClick={connect.connect} disabled={connect.busy}>Permitir</Button>
        </section>
      )}

      {connect.message && <p role="status" className="subhead mt-4 px-1 text-[var(--muted)]">{connect.message}</p>}

      {connected && (
        <div className="mt-4 flex items-center justify-between px-1">
          <p className="footnote text-[var(--muted)]">
            {health.status === 'loading' ? 'Atualizando...' : (health.lastLive ?? health.lastRefreshed) ? `Atualizado ${formatDistanceToNow(Math.max(health.lastLive ?? 0, health.lastRefreshed ?? 0), { locale: ptBR, addSuffix: true })} · automático` : 'Ainda não atualizado'}
          </p>
          <button type="button" onClick={refresh} disabled={health.status === 'loading'} className="link text-[15px] disabled:opacity-40">
            <RefreshCw size={14} className={health.status === 'loading' ? 'animate-spin' : ''} aria-hidden />Atualizar
          </button>
        </div>
      )}

      {(health.heartToday?.latest || health.heartDaily.length > 0) && (
        <section aria-labelledby="hr-title" className="stack-section">
          <SectionHeader id="hr-title" title="Frequência cardíaca." subtitle="Hoje, conforme o relógio sincroniza." />
          <HeartRateCard today={health.heartToday} days={health.heartDaily} resting={health.restingHr.at(-1)?.value ?? null} />
        </section>
      )}

      {/* Readiness */}
      {readiness && (
        <section aria-labelledby="readiness-title" className="stack-section">
          <SectionHeader id="readiness-title" title="Prontidão." subtitle="Recuperação de hoje, comparada com a sua média." />
          <div className="tile">
            <div className="flex items-center gap-6">
              <ScoreRing score={readiness.score} label={`Prontidão ${readiness.score} de 100`} />
              <div className="min-w-0">
                <p className="title-3">{readiness.headline}</p>
                <p className="subhead mt-1.5 text-[var(--muted)]">{readiness.advice}</p>
              </div>
            </div>
            <dl className="mt-6">
              {readiness.components.map((component) => (
                <div key={component.key} className="flex items-center gap-3 border-t border-[var(--separator)] py-3">
                  <dt className="min-w-0 flex-1">
                    <span className="block">{component.label}</span>
                    <span className="footnote text-[var(--muted)]">{component.detail}</span>
                  </dt>
                  <dd className="w-24">
                    <div className="progress-track" aria-label={`${component.label}: ${Math.round(component.score)} de 100`} role="img">
                      <div className="progress-fill" style={{ width: `${component.score}%` }} />
                    </div>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* Sleep */}
      {lastNight && (
        <section aria-labelledby="sleep-title" className="stack-section">
          <SectionHeader id="sleep-title" title="Sono." href="/sleep" />
          <Link href="/sleep" className="tile tile-link block">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="subhead text-[var(--muted)]">{isToday(lastNight.end) ? 'Última noite' : format(lastNight.end, "d 'de' MMM", { locale: ptBR })}</p>
                <p className="stat mt-1 text-[40px]">{formatHm(lastNight.asleep)}</p>
              </div>
              {avgSleep != null && <p className="subhead text-right text-[var(--muted)]">Média 7 dias<br /><span className="font-semibold text-[var(--foreground)]">{formatHm(avgSleep)}</span></p>}
            </div>
            <div className="mt-5"><Hypnogram night={lastNight} /></div>
            <div className="mt-5"><StageLegend night={lastNight} /></div>
          </Link>
        </section>
      )}

      {/* Cardio */}
      <section aria-labelledby="cardio-title" className="stack-section">
        <SectionHeader id="cardio-title" title="Cardio." href="/cardio" />
        <div className="tile">
          <div className="flex items-baseline justify-between gap-3">
            <p className="subhead text-[var(--muted)]">Esta semana</p>
            <p className="stat text-[32px]">{cardioMinutes}<span className="stat-unit">/ {cardioGoal} min</span></p>
          </div>
          <div className="progress-track mt-3" role="progressbar" aria-label={`Cardio: ${cardioMinutes} de ${cardioGoal} minutos`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((cardioMinutes / cardioGoal) * 100))}>
            <div className="progress-fill" style={{ width: `${Math.min(100, (cardioMinutes / cardioGoal) * 100)}%`, background: cardioMinutes >= cardioGoal ? 'var(--success-fill)' : undefined }} />
          </div>
          <p className="footnote mt-2 text-[var(--muted)]">A OMS recomenda 150 minutos de atividade moderada por semana.</p>
          {cardio.length > 0 ? (
            <ul className="mt-5">
              {cardio.slice(0, 3).map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setSelected(item)} className="flex w-full items-center gap-3 border-t border-[var(--separator)] py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="headline block">{cardioLabel(item.activity)}</span>
                      <span className="footnote text-[var(--muted)]">{format(new Date(item.startedAt), "EEE, d 'de' MMM", { locale: ptBR })} · {formatMinutes(item.duration)}{item.distance ? ` · ${formatDistance(item.distance)}` : ''}</span>
                    </span>
                    <ChevronRight size={17} className="flex-none text-[var(--muted)]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Button variant="secondary" className="mt-5 w-full" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus size={16} aria-hidden />Registrar cardio</Button>
          )}
        </div>
      </section>

      {/* Heart */}
      {(health.restingHr.length > 0 || health.hrv.length > 0 || health.vo2Max.length > 0) && (
        <section aria-labelledby="heart-title" className="stack-section">
          <SectionHeader id="heart-title" title="Coração." subtitle="Últimos 90 dias." />
          <div className="space-y-3">
            <MetricTile title="FC em repouso" unit="bpm" series={health.restingHr} lowerIsBetter />
            <MetricTile title="Variabilidade (HRV)" unit="ms" series={health.hrv} />
            <MetricTile title="VO2 máx" unit="ml/kg/min" series={health.vo2Max} />
          </div>
        </section>
      )}

      {/* Steps */}
      {health.steps.length > 0 && (
        <section aria-labelledby="steps-title" className="stack-section">
          <SectionHeader id="steps-title" title="Passos." />
          <div className="tile">
            <p className="subhead text-[var(--muted)]">Hoje</p>
            <p className="stat mt-1 text-[40px]">{todaySteps != null ? todaySteps.toLocaleString('pt-BR') : '—'}</p>
            <div className="mt-5">
              <MiniBars
                data={health.steps.slice(-7).map((day) => ({ label: format(day.date, 'EEEEE', { locale: ptBR }), value: day.value }))}
                goal={8000}
                format={(value) => `${value.toLocaleString('pt-BR')} passos`}
              />
            </div>
            <p className="footnote mt-3 text-[var(--muted)]">Linha tracejada: 8.000 passos.</p>
          </div>
        </section>
      )}

      <CardioForm open={formOpen} initial={editing} onClose={() => { setFormOpen(false); setEditing(null) }} />
      <CardioDetail session={selected} onClose={() => setSelected(null)} onEdit={(item) => { setSelected(null); setEditing(item); setFormOpen(true) }} />
    </div>
  )
}

function MetricTile({ title, unit, series, lowerIsBetter }: { title: string; unit: string; series: Array<{ date: Date; value: number }>; lowerIsBetter?: boolean }) {
  if (series.length === 0) return null
  const latest = series.at(-1)!
  const slope = trendPer30Days(series)
  const improving = slope == null || Math.abs(slope) < 0.05 ? null : lowerIsBetter ? slope < 0 : slope > 0
  return (
    <div className="tile">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="subhead text-[var(--muted)]">{title}</p>
          <p className="stat mt-1 text-[34px]">{formatDecimal(Math.round(latest.value * 10) / 10)}<span className="stat-unit">{unit}</span></p>
        </div>
        {slope != null && (
          <p className={`subhead text-right ${improving == null ? 'text-[var(--muted)]' : improving ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
            {slope >= 0 ? '+' : ''}{formatDecimal(Math.round(slope * 10) / 10)} {unit}/mês
          </p>
        )}
      </div>
      {series.length > 1 && (
        <div className="mt-4">
          <LineChart
            points={series}
            height={100}
            format={(value) => `${formatDecimal(Math.round(value * 10) / 10)}`}
            label={`${title}: ${series.length} leituras, de ${formatDecimal(series[0].value)} a ${formatDecimal(latest.value)} ${unit}.`}
          />
        </div>
      )}
    </div>
  )
}
