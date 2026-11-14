'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { useCardioStore } from '@/stores/useCardioStore'
import { useProfileStore } from '@/stores/useProfileStore'
import {
  CARDIO_ACTIVITIES, cardioLabel, formatDistance, formatMinutes, formatPace, maxHeartRate, zoneRanges, ZONES,
} from '@/lib/cardio'
import type { CardioActivity, CardioSession } from '@/types'

function toLocalInput(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

/** Manual cardio entry (treadmill, bike, stairs...) for people without a watch. */
export function CardioForm({ open, initial, onClose }: { open: boolean; initial?: CardioSession | null; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar cardio' : 'Registrar cardio'}>
      {open && <CardioFormBody key={initial?.id ?? 'new'} initial={initial ?? null} onClose={onClose} />}
    </Modal>
  )
}

function CardioFormBody({ initial, onClose }: { initial: CardioSession | null; onClose: () => void }) {
  const add = useCardioStore((state) => state.add)
  const update = useCardioStore((state) => state.update)
  const [activity, setActivity] = useState<CardioActivity>(initial?.activity ?? 'running')
  const [startedAt, setStartedAt] = useState(() => toLocalInput(initial ? new Date(initial.startedAt) : new Date(Date.now() - 30 * 60_000)))
  const [minutes, setMinutes] = useState(initial ? Math.round(initial.duration / 60) : 30)
  const [km, setKm] = useState<number>(initial?.distance ? Math.round(initial.distance / 10) / 100 : 0)
  const [avgHr, setAvgHr] = useState<number>(initial?.avgHeartRate ?? 0)
  const [effort, setEffort] = useState(initial?.effort ?? 6)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const hasDistance = CARDIO_ACTIVITIES.find((item) => item.value === activity)?.hasDistance ?? false

  async function save() {
    if (minutes <= 0 || saving) return
    setSaving(true)
    const data = {
      activity,
      startedAt: new Date(startedAt),
      duration: Math.round(minutes * 60),
      distance: hasDistance && km > 0 ? Math.round(km * 1000) : null,
      avgHeartRate: avgHr > 0 ? Math.round(avgHr) : null,
      effort,
      notes: notes.trim(),
    }
    try {
      if (initial) await update(initial.id, data)
      else await add({ ...data, calories: null, maxHeartRate: null, zones: null, source: 'manual', externalId: null, sourceName: null })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const label = 'mb-2 block px-1 text-[13px] font-semibold text-[var(--muted)]'
  return (
    <div className="space-y-5">
      <div>
        <p className={label}>Atividade</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Atividade">
          {CARDIO_ACTIVITIES.map((item) => (
            <button key={item.value} type="button" aria-pressed={activity === item.value} onClick={() => setActivity(item.value)} className="chip">{item.label}</button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className={label}>Início</span>
        <input type="datetime-local" value={startedAt} max={toLocalInput(new Date())} onChange={(event) => setStartedAt(event.target.value)} className="field" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Duração (min)</span>
          <DecimalInput integer min={1} max={1440} value={minutes} onValueChange={setMinutes} className="field numeric" />
        </label>
        {hasDistance ? (
          <label className="block">
            <span className={label}>Distância (km)</span>
            <DecimalInput min={0} max={500} value={km} onValueChange={setKm} className="field numeric" placeholder="—" />
          </label>
        ) : (
          <label className="block">
            <span className={label}>FC média (bpm)</span>
            <DecimalInput integer min={0} max={230} value={avgHr || null} onValueChange={setAvgHr} className="field numeric" placeholder="—" />
          </label>
        )}
      </div>
      {hasDistance && (
        <label className="block">
          <span className={label}>FC média (bpm, opcional)</span>
          <DecimalInput integer min={0} max={230} value={avgHr || null} onValueChange={setAvgHr} className="field numeric" placeholder="—" />
        </label>
      )}
      <label className="block">
        <span className={`${label} flex justify-between`}><span>Esforço percebido</span><span className="numeric text-[var(--foreground)]">{effort}/10</span></span>
        <input type="range" min={1} max={10} value={effort} onChange={(event) => setEffort(Number(event.target.value))} className="w-full accent-[var(--accent-fill)]" aria-valuetext={`${effort} de 10`} />
        <span className="caption flex justify-between px-1 text-[var(--muted)]"><span>Leve</span><span>Máximo</span></span>
      </label>
      <label className="block">
        <span className={label}>Notas</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="field resize-none py-3" placeholder="Inclinação, intervalos, como se sentiu..." />
      </label>
      <Button size="lg" className="w-full" onClick={save} disabled={saving || minutes <= 0}>{initial ? 'Salvar' : 'Registrar'}</Button>
    </div>
  )
}

export function CardioDetail({ session, onClose, onEdit }: { session: CardioSession | null; onClose: () => void; onEdit: (session: CardioSession) => void }) {
  const remove = useCardioStore((state) => state.remove)
  const preferences = useProfileStore((state) => state.profile?.preferences)
  const [confirming, setConfirming] = useState(false)
  const maxHr = maxHeartRate(preferences)
  const pace = session ? formatPace(session.duration, session.distance) : null
  const totalZone = session?.zones?.reduce((a, b) => a + b, 0) ?? 0

  return (
    <Modal open={!!session} onClose={() => { setConfirming(false); onClose() }} ariaLabel={session ? cardioLabel(session.activity) : 'Cardio'}>
      {session && (
        <div className="pb-2">
          <p className="eyebrow">{format(new Date(session.startedAt), "EEEE, d 'de' MMMM · HH:mm", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())}</p>
          <h2 className="display mt-1">{cardioLabel(session.activity)}</h2>
          <p className="subhead mt-1 text-[var(--muted)]">{session.source === 'health' ? `Importado${session.sourceName ? ` de ${session.sourceName}` : ''}` : session.sourceName ? 'Registrado ao vivo no app' : 'Registrado manualmente'}</p>

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
            {[
              ['Duração', formatMinutes(session.duration)],
              ['Distância', formatDistance(session.distance)],
              ['Ritmo', pace ?? '—'],
              ['Calorias', session.calories ? `${session.calories} kcal` : '—'],
              ['FC média', session.avgHeartRate ? `${session.avgHeartRate} bpm` : '—'],
              ['FC máxima', session.maxHeartRate ? `${session.maxHeartRate} bpm` : session.effort ? `Esforço ${session.effort}/10` : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="footnote text-[var(--muted)]">{label}</dt>
                <dd className="stat mt-0.5 text-[24px]">{value}</dd>
              </div>
            ))}
          </dl>

          {session.zones && totalZone > 0 ? (
            <section className="mt-7" aria-label="Zonas de frequência cardíaca">
              <p className="headline">Zonas de frequência cardíaca</p>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full" aria-hidden>
                {session.zones.map((seconds, index) => seconds > 0 && <span key={index} style={{ width: `${(seconds / totalZone) * 100}%`, background: ZONES[index].color }} />)}
              </div>
              <ul className="mt-4 space-y-2">
                {(maxHr ? zoneRanges(maxHr) : ZONES.map((zone) => ({ ...zone, from: 0, to: 0 }))).map((zone, index) => (
                  <li key={zone.label} className="flex items-center gap-3">
                    <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: zone.color }} />
                    <span className="subhead flex-1">{zone.label} · {zone.name}{maxHr ? <span className="text-[var(--muted)]"> ({zone.from}–{zone.to})</span> : null}</span>
                    <span className="subhead numeric font-semibold">{formatMinutes(session.zones![index])}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : session.source === 'health' && !maxHr ? (
            <p className="subhead mt-6 text-[var(--muted)]">
              Informe seu ano de nascimento em <Link href="/settings#coracao" className="text-[var(--accent)]">Ajustes</Link> para ver o tempo em cada zona nos próximos treinos.
            </p>
          ) : null}

          {session.notes && <p className="body-text mt-6 text-[var(--muted)]">{session.notes}</p>}

          <div className="mt-8 flex gap-3">
            {session.source === 'manual' && <Button variant="secondary" className="flex-1" onClick={() => onEdit(session)}>Editar</Button>}
            {confirming ? (
              <Button variant="danger" className="flex-1" onClick={async () => { await remove(session.id); setConfirming(false); onClose() }}>Confirmar exclusão</Button>
            ) : (
              <Button variant="danger" className="flex-1" onClick={() => setConfirming(true)}><Trash2 size={15} aria-hidden />Excluir</Button>
            )}
          </div>
          {session.source === 'health' && confirming && <p className="footnote mt-2 text-[var(--muted)]">O treino continua no Health Connect, mas não será importado de novo.</p>}
        </div>
      )}
    </Modal>
  )
}
