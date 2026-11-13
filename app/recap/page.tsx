'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addMonths, endOfMonth, endOfYear, format, isAfter, startOfMonth, startOfYear, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Share, X } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useCardioStore } from '@/stores/useCardioStore'
import { formatDistance } from '@/lib/cardio'
import { buildRecap, volumeComparison } from '@/lib/insights'
import { renderShareCard, shareImage } from '@/lib/shareCard'
import { formatVolume } from '@/lib/utils'

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

function parsePeriod(params: URLSearchParams, now: Date) {
  const year = params.get('year')
  if (year && /^\d{4}$/.test(year)) {
    const start = startOfYear(new Date(Number(year), 0, 1))
    return { kind: 'year' as const, start, end: endOfYear(start), label: year, noun: `em ${year}` }
  }
  const month = params.get('month')
  const match = month ? /^(\d{4})-(\d{2})$/.exec(month) : null
  const start = match ? startOfMonth(new Date(Number(match[1]), Number(match[2]) - 1, 1)) : startOfMonth(now)
  const name = format(start, 'MMMM', { locale: ptBR })
  return { kind: 'month' as const, start, end: endOfMonth(start), label: `${name} ${format(start, 'yyyy')}`, noun: `em ${name}` }
}

function hours(seconds: number) {
  const value = seconds / 3600
  return value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
}

function RecapContent() {
  const router = useRouter()
  const params = useSearchParams()
  const sessions = useProfileStore((state) => state.sessions)
  const workouts = useWorkoutStore((state) => state.workouts)
  const exercises = useWorkoutStore((state) => state.exercises)
  const cardioSessions = useCardioStore((state) => state.sessions)
  const [now] = useState(() => new Date())
  const [sharing, setSharing] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const period = parsePeriod(params, now)
  const recap = useMemo(() => buildRecap(sessions, workouts, exercises, period.start, period.end), [exercises, period.end, period.start, sessions, workouts])
  const comparison = volumeComparison(recap.volume)
  const cardio = useMemo(() => {
    const items = cardioSessions.filter((item) => new Date(item.startedAt) >= period.start && new Date(item.startedAt) <= period.end)
    return {
      count: items.length,
      minutes: Math.round(items.reduce((total, item) => total + item.duration, 0) / 60),
      distance: items.reduce((total, item) => total + (item.distance ?? 0), 0),
    }
  }, [cardioSessions, period.end, period.start])

  function go(direction: -1 | 1) {
    if (period.kind === 'year') {
      router.replace(`/recap?year=${Number(period.label) + direction}`)
    } else {
      const next = direction < 0 ? subMonths(period.start, 1) : addMonths(period.start, 1)
      router.replace(`/recap?month=${format(next, 'yyyy-MM')}`)
    }
  }
  const nextDisabled = isAfter(period.kind === 'year' ? startOfYear(new Date(now.getFullYear() + 1, 0, 1)) : addMonths(period.start, 1), now)

  async function share() {
    setSharing(true)
    setNote(null)
    try {
      const blob = await renderShareCard({
        eyebrow: `Retrospectiva · ${period.label}`,
        title: `${recap.sessions} treinos`,
        subtitle: comparison ? `${formatVolume(recap.volume)} levantados — ${comparison}` : `${formatVolume(recap.volume)} levantados`,
        stats: [
          { label: 'Horas', value: `${hours(recap.seconds)} h` },
          { label: 'Séries', value: `${recap.sets}` },
          { label: 'Recordes', value: `${recap.records}` },
          { label: 'Maior sequência', value: `${recap.longestStreak} ${recap.longestStreak === 1 ? 'dia' : 'dias'}` },
        ],
        highlight: recap.topExercise ? `Favorito: ${recap.topExercise.name}` : undefined,
      })
      const result = await shareImage(blob, `workoutpro-retrospectiva-${format(period.start, period.kind === 'year' ? 'yyyy' : 'yyyy-MM')}.png`, `Minha retrospectiva de ${period.label} no WorkoutPro`)
      if (result === 'downloaded') setNote('Imagem salva.')
    } catch {
      setNote('Não foi possível gerar a imagem.')
    } finally {
      setSharing(false)
    }
  }

  const slides: Array<{ eyebrow: string; value: string; unit?: string; caption: string }> = recap.sessions === 0 && cardio.count === 0 ? [] : [
    { eyebrow: period.label, value: `${recap.sessions}`, unit: recap.sessions === 1 ? 'treino' : 'treinos', caption: `em ${recap.activeDays} ${recap.activeDays === 1 ? 'dia' : 'dias'} diferentes.` },
    { eyebrow: 'Volume', value: formatVolume(recap.volume).replace(' kg', ''), unit: 'kg', caption: comparison ? `É o peso de ${comparison}.` : 'levantados ao todo.' },
    { eyebrow: 'Tempo', value: `${hours(recap.seconds)}`, unit: 'horas', caption: `e ${recap.sets} séries registradas.` },
    ...(recap.topExercise ? [{ eyebrow: 'Seu exercício', value: recap.topExercise.name, caption: `${recap.topExercise.sets} séries de trabalho. Ninguém apareceu mais.` }] : []),
    ...(recap.topMuscle ? [{ eyebrow: 'Músculo mais treinado', value: recap.topMuscle.name, caption: `${recap.topMuscle.sets} séries ${period.noun}.` }] : []),
    ...(recap.records > 0 ? [{ eyebrow: 'Recordes', value: `${recap.records}`, unit: recap.records === 1 ? 'novo recorde' : 'novos recordes', caption: recap.heaviest ? `Carga mais pesada: ${recap.heaviest.weight} kg no ${recap.heaviest.name}.` : 'Você ficou mais forte.' }] : []),
    ...(recap.favoriteWeekday ? [{ eyebrow: 'Seu dia', value: WEEKDAYS[recap.favoriteWeekday.index], caption: `${recap.favoriteWeekday.count} treinos caíram nesse dia da semana.` }] : []),
    ...(cardio.count > 0 ? [{
      eyebrow: 'Cardio',
      value: `${cardio.minutes}`,
      unit: 'minutos de cardio',
      caption: `${cardio.count} ${cardio.count === 1 ? 'sessão' : 'sessões'}${cardio.distance > 0 ? ` e ${formatDistance(cardio.distance)} percorridos` : ''}.`,
    }] : []),
    { eyebrow: 'Constância', value: `${recap.longestStreak}`, unit: recap.longestStreak === 1 ? 'dia seguido' : 'dias seguidos', caption: recap.favoriteWorkout ? `Rotina favorita: ${recap.favoriteWorkout.name}.` : 'Sua maior sequência no período.' },
  ]

  return (
    <div className="min-h-dvh bg-black text-[#f5f5f7]" data-theme-surface="dark">
      <div className="fixed left-0 right-0 top-0 z-20 flex items-center gap-2 px-3 pb-2" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', background: 'linear-gradient(#000 60%, transparent)' }}>
        <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push('/stats'))} className="flex h-11 w-11 items-center justify-center rounded-full text-[#f5f5f7]" aria-label="Fechar retrospectiva">
          <X size={22} aria-hidden />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1">
          <button type="button" onClick={() => go(-1)} className="flex h-11 w-11 items-center justify-center text-[#2997ff]" aria-label="Período anterior"><ChevronLeft size={22} aria-hidden /></button>
          <h1 className="headline min-w-0 truncate capitalize">{period.label}</h1>
          <button type="button" onClick={() => go(1)} disabled={nextDisabled} className="flex h-11 w-11 items-center justify-center text-[#2997ff] disabled:opacity-30" aria-label="Próximo período"><ChevronRight size={22} aria-hidden /></button>
        </div>
        <button type="button" onClick={share} disabled={sharing || recap.sessions === 0} className="flex h-11 w-11 items-center justify-center rounded-full text-[#2997ff] disabled:opacity-30" aria-label="Compartilhar retrospectiva">
          <Share size={20} aria-hidden />
        </button>
      </div>

      {slides.length === 0 ? (
        <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
          <p className="eyebrow !text-[#ff8a3d] capitalize">{period.label}</p>
          <p className="display mt-2">Nada por aqui.</p>
          <p className="lede mt-3 !text-[#a1a1a6]">Nenhum treino registrado neste período.</p>
        </div>
      ) : (
        <div className="h-dvh snap-y snap-mandatory overflow-y-auto">
          {slides.map((slide, index) => (
            <section key={index} className="flex min-h-dvh snap-start flex-col justify-center px-8 py-24" aria-label={slide.eyebrow}>
              <div className="rise-in mx-auto w-full max-w-xl">
                <p className="eyebrow capitalize !text-[#ff8a3d]">{slide.eyebrow}</p>
                <p className={`text-gradient-dark mt-2 font-bold leading-[1.02] tracking-[-0.04em] ${slide.value.length > 12 ? 'text-[48px] sm:text-[64px]' : 'text-[88px] sm:text-[120px]'} first-letter:uppercase`} style={{ fontFamily: 'var(--font-display)' }}>
                  {slide.value}
                </p>
                {slide.unit && <p className="title-2 mt-1 text-[#f5f5f7]">{slide.unit}</p>}
                <p className="lede mt-4 max-w-md !text-[#a1a1a6]">{slide.caption}</p>
                {index === 0 && <p className="footnote mt-16 text-[#6e6e73]">Role para ver mais</p>}
              </div>
            </section>
          ))}
          <section className="flex min-h-dvh snap-start flex-col items-center justify-center px-8 text-center">
            <p className="display">Continue assim.</p>
            <button type="button" onClick={share} disabled={sharing} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#0071e3] px-7 text-[17px] text-white disabled:opacity-50">
              <Share size={17} aria-hidden />{sharing ? 'Gerando...' : 'Compartilhar'}
            </button>
            {note && <p role="status" className="footnote mt-3 text-[#a1a1a6]">{note}</p>}
          </section>
        </div>
      )}
    </div>
  )
}

export default function RecapPage() {
  return <Suspense fallback={null}><RecapContent /></Suspense>
}
