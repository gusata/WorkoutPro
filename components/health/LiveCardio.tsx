'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Heart, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CARDIO_ACTIVITIES, cardioLabel, maxHeartRate, ZONES } from '@/lib/cardio'
import { formatSampleAge, freshSample, liveZones } from '@/lib/liveHeart'
import { useHealthStore } from '@/stores/useHealthStore'
import { MIN_LIVE_SECONDS, toSamples, useLiveCardioStore } from '@/stores/useLiveCardioStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { cn } from '@/lib/cn'
import type { CardioActivity, CardioSession } from '@/types'

function useNow(intervalMs: number, enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [enabled, intervalMs])
  return now
}

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`
}

/**
 * Start / stop a cardio activity in the app. While it runs, shows the live heart rate,
 * the current zone and the time in each zone from the same Health Connect stream as the
 * rest of the app; on stop, zones are computed from all samples of the interval.
 */
export function LiveCardio({ onSaved }: { onSaved: (session: CardioSession) => void }) {
  const live = useLiveCardioStore((state) => state.live)
  const start = useLiveCardioStore((state) => state.start)
  const stop = useLiveCardioStore((state) => state.stop)
  const discard = useLiveCardioStore((state) => state.discard)
  const pull = useLiveCardioStore((state) => state.pull)
  const preferences = useProfileStore((state) => state.profile?.preferences)
  const healthSync = preferences?.healthSync ?? false
  const latestTime = useHealthStore((state) => state.heartToday?.latest?.time ?? null)
  const latest = useHealthStore((state) => state.heartToday?.latest ?? null)
  const [activity, setActivity] = useState<CardioActivity>('running')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const now = useNow(1000, Boolean(live))
  const maxHr = maxHeartRate(preferences)

  // Each new reading in Health Connect (HealthSync checks every 5 s) pulls the samples since the last one.
  const latestKey = latestTime ? new Date(latestTime).getTime() : 0
  const liveStartedAt = live?.startedAt ?? null
  useEffect(() => {
    if (liveStartedAt != null && healthSync) void pull()
  }, [healthSync, latestKey, liveStartedAt, pull])

  const samples = useMemo(() => toSamples(live?.samples ?? []), [live?.samples])
  const stats = live ? liveZones(samples, live.startedAt, maxHr, now) : null

  async function finish() {
    if (saving) return
    setSaving(true)
    try {
      const saved = await stop()
      if (saved) onSaved(saved)
      else setMessage(`Atividade com menos de ${MIN_LIVE_SECONDS / 60} min não foi salva.`)
    } catch {
      setMessage('Não foi possível salvar o cardio.')
    } finally {
      setSaving(false)
    }
  }

  if (!live || !stats) {
    return (
      <section className="tile mt-8" aria-labelledby="live-cardio-title">
        <p id="live-cardio-title" className="headline">Cardio ao vivo</p>
        <p className="footnote mt-1 text-[var(--muted)]">
          {healthSync
            ? 'Cronometra a atividade e mostra a frequência cardíaca e a zona enquanto o relógio sincroniza.'
            : <>Cronometra a atividade. <Link href="/health" className="text-[var(--accent)]">Conecte o relógio</Link> para ver a frequência cardíaca e as zonas.</>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Atividade">
          {CARDIO_ACTIVITIES.map((item) => (
            <button key={item.value} type="button" aria-pressed={activity === item.value} onClick={() => setActivity(item.value)} className="chip">{item.label}</button>
          ))}
        </div>
        <Button className="mt-5" onClick={() => { setMessage(null); start(activity) }}><Play size={16} aria-hidden />Iniciar</Button>
        {message && <p role="status" className="footnote mt-3 text-[var(--muted)]">{message}</p>}
      </section>
    )
  }

  const elapsed = (now - live.startedAt) / 1000
  const zone = stats.zone >= 0 ? ZONES[stats.zone] : null
  // Before the first sample of the activity arrives, the general live reading still helps.
  const fallback = stats.bpm == null ? freshSample(latest, now) : null
  const bpm = stats.bpm ?? fallback?.bpm ?? null
  const sampleTime = samples.at(-1)?.time ?? (fallback ? new Date(fallback.time) : null)
  const zoneTotal = stats.zones.reduce((a, b) => a + b, 0)

  return (
    <section className="tile mt-8" aria-labelledby="live-cardio-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p id="live-cardio-title" className="eyebrow">{cardioLabel(live.activity)} · ao vivo</p>
          <p className="stat mt-1 text-[40px] leading-none" role="timer" aria-live="off">{clock(elapsed)}</p>
        </div>
        <div className="text-right">
          {bpm != null ? (
            <>
              <p className="stat flex items-center justify-end gap-1.5 text-[32px] leading-none">
                <Heart size={20} fill="#ff375f" stroke="#ff375f" aria-hidden />{bpm}
              </p>
              <p className="footnote mt-1 text-[var(--muted)]">bpm{sampleTime ? ` · ${formatSampleAge(sampleTime, now)}` : ''}</p>
            </>
          ) : (
            <p className="footnote max-w-[9rem] text-[var(--muted)]">{healthSync ? 'Aguardando o relógio sincronizar...' : 'Sem frequência cardíaca'}</p>
          )}
        </div>
      </div>

      {zone && (
        <p className="headline mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-white" style={{ background: zone.color }}>
          Z{stats.zone + 1} · {zone.name}
        </p>
      )}

      {maxHr ? (
        <ul className="mt-5 space-y-2" aria-label="Tempo em cada zona">
          {ZONES.map((item, index) => (
            <li key={item.label} className={cn('flex items-center gap-3', stats.zone === index ? 'font-semibold' : '')}>
              <span className="subhead w-7">Z{index + 1}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--fill)]" aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${zoneTotal ? (stats.zones[index] / zoneTotal) * 100 : 0}%`, background: item.color }} />
              </span>
              <span className="subhead numeric w-14 text-right">{clock(stats.zones[index])}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="footnote mt-4 text-[var(--muted)]">
          Informe seu ano de nascimento em <Link href="/settings#coracao" className="text-[var(--accent)]">Ajustes</Link> para ver as zonas.
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={discard} disabled={saving}>Descartar</Button>
        <Button className="flex-1" onClick={() => void finish()} disabled={saving}><Square size={14} fill="currentColor" aria-hidden />{saving ? 'Salvando...' : 'Parar e salvar'}</Button>
      </div>
    </section>
  )
}
