'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Minus, Plus } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { Hero, LocalNav } from '@/components/layout/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { Button } from '@/components/ui/Button'
import { setTheme, useThemePreference } from '@/components/layout/ThemeToggle'
import { useReduceEffects } from '@/components/layout/VisualEffectsToggle'
import { DEFAULT_BAR_WEIGHT, getWeeklyGoals } from '@/lib/preferences'
import { formatTimeOfDay, reminderTime, remindersSupported, usualTrainingTime } from '@/lib/reminders'
import { healthPlatformName, latestRestingHeartRate } from '@/lib/health'
import { useHealthConnect } from '@/components/health/useHealthConnect'
import { DEFAULT_CARDIO_GOAL, maxHeartRate, zoneRanges } from '@/lib/cardio'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { MuscleTargetsSettings } from '@/components/insights/MuscleTargetsSettings'
import type { ThemePreference } from '@/lib/theme'
import type { WeeklyGoals } from '@/types'

const EQUIPMENT = ['Barra', 'Halteres', 'Máquinas', 'Cabos', 'Peso corporal', 'Elásticos']

function Row({ label, detail, children, htmlFor }: { label: string; detail?: React.ReactNode; children?: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="grouped-row flex min-h-14 items-center gap-4 px-5 py-3">
      <span className="min-w-0 flex-1">
        {htmlFor ? <label htmlFor={htmlFor} className="block">{label}</label> : <span className="block">{label}</span>}
        {detail && <span className="footnote mt-0.5 block text-[var(--muted)]">{detail}</span>}
      </span>
      {children}
    </div>
  )
}

function Stepper({ label, value, step, min, max, unit, onChange }: { label: string; value: number; step: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-none items-center gap-1" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--fill)] disabled:opacity-30" aria-label={`Diminuir ${label}`}>
        <Minus size={16} aria-hidden />
      </button>
      <output className="numeric w-16 text-center text-[17px] font-semibold" aria-live="polite">{value}{unit ? <span className="text-[13px] font-normal text-[var(--muted)]"> {unit}</span> : null}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--fill)] disabled:opacity-30" aria-label={`Aumentar ${label}`}>
        <Plus size={16} aria-hidden />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const profile = useProfileStore((state) => state.profile)
  const sessions = useProfileStore((state) => state.sessions)
  const updateProfile = useProfileStore((state) => state.updateProfile)
  const updatePreferences = useProfileStore((state) => state.updatePreferences)
  const importHealthMeasurements = useProfileStore((state) => state.importHealthMeasurements)
  const healthConnect = useHealthConnect()
  const workouts = useWorkoutStore((state) => state.workouts)
  const themePreference = useThemePreference()
  const [reduceEffects, setReduceEffects] = useReduceEffects()
  const health = healthConnect.availability
  const [healthStatus, setHealthStatus] = useState<string | null>(null)
  const [restingHr, setRestingHr] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const preferences = profile?.preferences ?? {}
  const goals = getWeeklyGoals(profile)
  const reminders = preferences.reminders ?? { enabled: false, timeOfDay: null }
  const usual = usualTrainingTime(sessions)
  const time = reminderTime(reminders, sessions)
  const scheduledCount = workouts.filter((workout) => (workout.scheduledWeekdays ?? []).length > 0).length

  useEffect(() => {
    if (!preferences.healthSync || !health?.available) return
    void latestRestingHeartRate().then(setRestingHr)
  }, [health?.available, preferences.healthSync])

  function setGoal(key: keyof WeeklyGoals, value: number) {
    void updatePreferences({ weeklyGoals: { ...goals, [key]: value } })
  }

  async function toggleHealth(enabled: boolean) {
    setHealthStatus(null)
    if (enabled) await healthConnect.connect()
    else await healthConnect.disconnect()
  }

  const maxHr = maxHeartRate(preferences)
  const thisYear = new Date().getFullYear()

  async function importNow() {
    setBusy(true)
    try {
      const added = await importHealthMeasurements()
      setHealthStatus(added > 0 ? `${added} ${added === 1 ? 'medida importada' : 'medidas importadas'}.` : 'Tudo em dia.')
    } catch {
      setHealthStatus('Não foi possível ler os dados agora.')
    } finally {
      setBusy(false)
    }
  }

  if (!profile) return null

  return (
    <div className="apple-page page-content page-narrow">
      <LocalNav title="Ajustes" back="/profile" />
      <Hero title="Ajustes." lede="Metas, lembretes, saúde e aparência." size="display" />

      <section id="metas" aria-labelledby="goals-title" className="stack-section scroll-mt-20">
        <h2 id="goals-title" className="list-header">Metas semanais</h2>
        <div className="list">
          <Row label="Treinos"><Stepper label="Meta de treinos" value={goals.workouts} step={1} min={1} max={14} onChange={(value) => setGoal('workouts', value)} /></Row>
          <Row label="Minutos"><Stepper label="Meta de minutos" value={goals.minutes} step={15} min={15} max={1200} onChange={(value) => setGoal('minutes', value)} /></Row>
          <Row label="Séries" detail={profile.trainingBlock ? 'Durante um bloco, a meta vem da periodização.' : undefined}>
            <Stepper label="Meta de séries" value={goals.sets} step={5} min={5} max={300} onChange={(value) => setGoal('sets', value)} />
          </Row>
          <Row label="Cardio" detail="Minutos por semana. A OMS recomenda 150.">
            <Stepper label="Meta de cardio" value={goals.cardioMinutes ?? DEFAULT_CARDIO_GOAL} step={15} min={15} max={1500} onChange={(value) => setGoal('cardioMinutes', value)} />
          </Row>
        </div>
        <p className="list-footer">Usadas na tela Hoje para acompanhar sua semana.</p>
      </section>

      <section aria-labelledby="reminders-title" className="stack-section">
        <h2 id="reminders-title" className="list-header">Lembretes</h2>
        <div className="list">
          <Row label="Lembrete de treino" detail={scheduledCount === 0 ? 'Defina dias nas suas rotinas para receber lembretes.' : `Em dias com treino agendado, às ${formatTimeOfDay(time)}.`}>
            <Switch label="Lembrete de treino" checked={reminders.enabled} onChange={(enabled) => void updatePreferences({ reminders: { ...reminders, enabled } })} />
          </Row>
          {reminders.enabled && (
            <Row label="Horário" htmlFor="reminder-time" detail={reminders.timeOfDay == null ? (usual != null ? `Automático: 30 min antes do seu horário habitual (${formatTimeOfDay(usual)}).` : 'Automático: 17:30 até aprender seu horário.') : 'Horário fixo.'}>
              <div className="flex flex-none items-center gap-2">
                {reminders.timeOfDay != null && (
                  <button type="button" className="link text-[15px]" onClick={() => void updatePreferences({ reminders: { ...reminders, timeOfDay: null } })}>Automático</button>
                )}
                <input
                  id="reminder-time"
                  type="time"
                  value={formatTimeOfDay(time)}
                  onChange={(event) => {
                    const [hh, mm] = event.target.value.split(':').map(Number)
                    if (Number.isFinite(hh) && Number.isFinite(mm)) void updatePreferences({ reminders: { ...reminders, timeOfDay: hh * 60 + mm } })
                  }}
                  className="field numeric !min-h-11 !w-auto !px-3 text-center"
                />
              </div>
            </Row>
          )}
        </div>
        <p className="list-footer">
          {remindersSupported()
            ? 'Exemplo: “Hoje é dia de Superior A”, no horário em que você costuma treinar.'
            : 'No navegador, o lembrete aparece na tela Hoje. Notificações agendadas funcionam no app instalado.'}
        </p>
      </section>

      <section aria-labelledby="health-title" className="stack-section">
        <h2 id="health-title" className="list-header">{healthPlatformName()}</h2>
        <div className="list">
          <Row
            label={`Sincronizar com ${healthPlatformName()}`}
            detail={health && !health.available ? health.reason : 'Importa peso e % de gordura, grava seu peso e mostra a frequência cardíaca média dos treinos.'}
          >
            <Switch label={`Sincronizar com ${healthPlatformName()}`} checked={Boolean(preferences.healthSync)} disabled={busy || healthConnect.busy || !health?.available} onChange={(enabled) => void toggleHealth(enabled)} />
          </Row>
          {health?.available && (
            <Row label={`Abrir ${healthPlatformName()}`} detail="Permissões e de quais apps os dados vêm, como o Samsung Health.">
              <Button size="sm" variant="secondary" onClick={() => void healthConnect.openSettings()}>Abrir</Button>
            </Row>
          )}
          {preferences.healthSync && health?.available && (
            <>
              <Row label="Importar medidas agora" detail="Últimos 30 dias">
                <Button size="sm" variant="secondary" onClick={importNow} disabled={busy}>Importar</Button>
              </Row>
              {restingHr != null && <Row label="FC em repouso" detail="Última leitura"><span className="numeric text-[var(--muted)]">{restingHr} bpm</span></Row>}
            </>
          )}
        </div>
        {(healthStatus ?? healthConnect.message) && <p role="status" className="list-footer">{healthStatus ?? healthConnect.message}</p>}
      </section>

      <section id="coracao" aria-labelledby="heart-title" className="stack-section scroll-mt-20">
        <h2 id="heart-title" className="list-header">Frequência cardíaca</h2>
        <div className="list">
          <Row label="Ano de nascimento" htmlFor="birth-year" detail="Para estimar sua FC máxima e as zonas de treino.">
            <DecimalInput
              id="birth-year"
              integer
              min={0}
              max={thisYear}
              value={preferences.birthYear ?? null}
              placeholder="—"
              onValueChange={(value) => { if (value === 0 || (value >= 1920 && value <= thisYear - 10)) void updatePreferences({ birthYear: value || null }) }}
              className="field numeric !min-h-11 !w-24 !px-3 text-center"
            />
          </Row>
          <Row label="FC máxima medida" htmlFor="max-hr" detail={preferences.maxHeartRate ? 'Usada no lugar da estimativa por idade.' : maxHr ? `Estimativa pela idade: ${maxHr} bpm. Informe se você já mediu a sua.` : 'Opcional, se você já mediu a sua.'}>
            <DecimalInput
              id="max-hr"
              integer
              min={0}
              max={230}
              value={preferences.maxHeartRate ?? null}
              placeholder="—"
              onValueChange={(value) => { if (value === 0 || (value >= 120 && value <= 230)) void updatePreferences({ maxHeartRate: value || null }) }}
              className="field numeric !min-h-11 !w-24 !px-3 text-center"
            />
          </Row>
        </div>
        {maxHr ? (
          <p className="list-footer">Zonas: {zoneRanges(maxHr).map((zone, index) => `Z${index + 1} ${zone.from}–${zone.to}`).join(' · ')} bpm.</p>
        ) : (
          <p className="list-footer">Sem idade ou FC máxima, as zonas dos treinos de cardio não são calculadas.</p>
        )}
      </section>

      <section aria-labelledby="training-title" className="stack-section">
        <h2 id="training-title" className="list-header">Treino</h2>
        <div className="list">
          <Row label="Peso da barra" detail="Usado na calculadora de anilhas e no aquecimento.">
            <Stepper label="Peso da barra" value={preferences.barWeight ?? DEFAULT_BAR_WEIGHT} step={5} min={5} max={25} unit="kg" onChange={(value) => void updatePreferences({ barWeight: value })} />
          </Row>
        </div>
        <div className="list mt-3 flex flex-wrap gap-2 p-5" role="group" aria-label="Equipamentos disponíveis">
          {EQUIPMENT.map((item) => {
            const selected = profile.availableEquipment?.includes(item) ?? false
            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                onClick={() => void updateProfile({ availableEquipment: selected ? (profile.availableEquipment ?? []).filter((value) => value !== item) : [...(profile.availableEquipment ?? []), item] })}
                className="chip"
              >
                {item}
              </button>
            )
          })}
        </div>
        <p className="list-footer">Equipamentos disponíveis personalizam as sugestões de exercícios.</p>
      </section>

      <MuscleTargetsSettings />

      <section aria-labelledby="appearance-title" className="stack-section">
        <h2 id="appearance-title" className="list-header">Aparência</h2>
        <div className="list">
          <div className="px-5 py-4">
            <SegmentedControl<ThemePreference>
              label="Tema"
              value={themePreference}
              onChange={setTheme}
              options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }, { value: 'system', label: 'Automático' }]}
            />
          </div>
          <Row label="Reduzir efeitos" detail="Menos transparência e movimento.">
            <Switch label="Reduzir efeitos" checked={reduceEffects} onChange={setReduceEffects} />
          </Row>
        </div>
      </section>

      <section className="stack-section">
        <div className="list">
          <Link href="/privacy" className="grouped-row flex min-h-14 items-center justify-between px-5">Privacidade e diagnóstico<ChevronRight size={18} className="text-[var(--muted)]" aria-hidden /></Link>
        </div>
      </section>
    </div>
  )
}
