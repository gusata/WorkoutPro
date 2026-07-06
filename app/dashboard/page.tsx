'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  Bell,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Play,
  Trophy,
  Weight,
  Zap,
} from 'lucide-react'
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { getLevelFromXp, levelTitle } from '@/lib/gamification'
import { formatVolume, formatDuration, formatDate } from '@/lib/utils'

const CORAL = '#e65f43'
const AMBER = '#f59e0b'
const INK = '#1f2024'

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.34, ease: 'easeOut' as const },
  }),
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--muted)]">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `${color}16` }}>
          <Icon size={14} style={{ color }} />
        </span>
      </div>
      <p className="text-xl font-semibold tracking-tight text-[var(--foreground)]">{value}</p>
    </Card>
  )
}

export default function Dashboard() {
  const { profile, sessions } = useProfileStore()
  const { workouts } = useWorkoutStore()
  const active = useSessionStore((s) => s.active)

  const levelInfo = useMemo(
    () => (profile ? getLevelFromXp(profile.xp) : { level: 1, currentXp: 0, xpNeeded: 100 }),
    [profile]
  )

  const weekSessions = useMemo(() => {
    const now = new Date()
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    return sessions.filter((s) => s.finishedAt && isWithinInterval(new Date(s.finishedAt), { start, end }))
  }, [sessions])

  const weekVolume = weekSessions.reduce((acc, s) => acc + s.totalVolume, 0)
  const weekTime = weekSessions.reduce((acc, s) => acc + s.duration, 0)
  const recentSessions = sessions.slice(0, 4)

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  const levelPct = Math.min((levelInfo.currentXp / Math.max(levelInfo.xpNeeded, 1)) * 100, 100)

  return (
    <div className="apple-page page-content space-y-5">
      <motion.header custom={0} variants={fadeUp} initial="hidden" animate="show" className="flex items-start justify-between pr-14">
        <div>
          <p className="text-sm text-[var(--muted)]">{greeting}</p>
          <h1 className="mt-1 max-w-[15rem] text-4xl font-semibold leading-tight tracking-normal text-[var(--foreground)]">
            {profile?.name ?? 'Atleta'}
          </h1>
        </div>
        <button
          type="button"
          aria-label="Notificacoes"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] shadow-sm"
          style={{ border: '1px solid var(--border)' }}
        >
          <Bell size={18} />
        </button>
      </motion.header>

      {active && (
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
          <Link href="/workouts/execute">
            <Card className="p-4" pressable>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `${active.workoutColor}18` }}>
                  <Play size={16} style={{ color: active.workoutColor }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">Treino ativo</p>
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{active.workoutName}</p>
                </div>
                <ChevronRight size={17} className="text-[var(--muted)]" />
              </div>
            </Card>
          </Link>
        </motion.div>
      )}

      <motion.section custom={2} variants={fadeUp} initial="hidden" animate="show">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="text-sm text-[var(--muted)]">Progresso</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                {levelTitle(levelInfo.level)}
              </h2>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                <span className="inline-flex items-center gap-1">
                  <Clock size={13} /> {formatDuration(weekTime)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Flame size={13} /> {profile?.streak ?? 0} dias
                </span>
                <span className="inline-flex items-center gap-1">
                  <Zap size={13} /> {profile?.xp.toLocaleString() ?? 0} XP
                </span>
              </div>
            </div>

            <div
              className="flex h-24 w-24 flex-none items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${CORAL} ${levelPct}%, var(--surface-3) 0)` }}
            >
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[var(--surface)]">
                <span className="text-xl font-bold text-[var(--foreground)]">{Math.round(levelPct)}%</span>
                <span className="text-[10px] text-[var(--muted)]">nivel {levelInfo.level}</span>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <Progress value={levelInfo.currentXp} max={levelInfo.xpNeeded} color={CORAL} size="sm" />
          </div>
        </Card>
      </motion.section>

      <motion.section custom={3} variants={fadeUp} initial="hidden" animate="show">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="apple-section-title">Minha atividade</h2>
          <span className="text-xs text-[var(--muted)]">{weekSessions.length} esta semana</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Dumbbell} label="Treinos" value={`${weekSessions.length}`} color={CORAL} />
          <StatCard icon={Weight} label="Volume" value={formatVolume(weekVolume)} color={INK} />
          <StatCard icon={Clock} label="Tempo" value={formatDuration(weekTime)} color={AMBER} />
        </div>
      </motion.section>

      <motion.section custom={4} variants={fadeUp} initial="hidden" animate="show">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="apple-section-title">Resumo</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Trophy} label="Treinos" value={`${profile?.totalWorkouts ?? 0}`} color={AMBER} />
          <StatCard icon={Activity} label="Volume total" value={formatVolume(profile?.totalVolume ?? 0)} color={CORAL} />
        </div>
      </motion.section>

      {workouts.length > 0 && !active && (
        <motion.section custom={5} variants={fadeUp} initial="hidden" animate="show">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="apple-section-title">Recomendacao</h2>
            <Link href="/workouts" className="text-xs font-semibold text-[var(--accent)]">
              Ver todos
            </Link>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {workouts.slice(0, 5).map((w, index) => (
              <Link key={w.id} href={`/workouts/detail?id=${w.id}`}>
                <motion.div
                  whileTap={{ scale: 0.96 }}
                  className="flex h-36 w-36 flex-none flex-col justify-between rounded-[28px] p-4 text-white shadow-sm"
                  style={{ background: index === 0 ? CORAL : w.color }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                    <Dumbbell size={16} />
                  </span>
                  <div>
                    <p className="text-base font-semibold leading-tight">{w.name}</p>
                    <p className="mt-1 text-xs text-white/80">{w.exerciseIds.length} exercicios</p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {recentSessions.length > 0 && (
        <motion.section custom={6} variants={fadeUp} initial="hidden" animate="show">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="apple-section-title">Historico recente</h2>
          </div>
          <div className="space-y-2">
            {recentSessions.map((s) => {
              const workout = workouts.find((w) => w.id === s.workoutId)
              return (
                <Card key={s.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${workout?.color ?? CORAL}18` }}>
                      <Dumbbell size={15} style={{ color: workout?.color ?? CORAL }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{workout?.name ?? 'Treino'}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {s.finishedAt ? formatDate(new Date(s.finishedAt)) : 'Em andamento'} - {formatVolume(s.totalVolume)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[var(--accent)]">+{s.xpEarned} XP</p>
                      <p className="text-[11px] text-[var(--muted)]">{formatDuration(s.duration)}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </motion.section>
      )}
    </div>
  )
}
