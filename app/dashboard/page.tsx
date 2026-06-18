'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Dumbbell, Flame, Zap, TrendingUp, Clock, Weight,
  ChevronRight, Play, Trophy
} from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { getLevelFromXp, levelTitle } from '@/lib/gamification'
import { formatVolume, formatDuration, formatDate } from '@/lib/utils'
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'

const GREEN  = '#00c896'
const INDIGO = '#6366f1'
const AMBER  = '#f59e0b'
const PINK   = '#ec4899'

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <Card className="p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="rounded-lg p-1.5" style={{ background: `${color}18` }}>
          <Icon size={13} style={{ color }} />
        </div>
        <span className="text-[11px] text-zinc-500 font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold text-white leading-none tracking-tight">{value}</p>
    </Card>
  )
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.38, ease: 'easeOut' as const },
  }),
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
    const end   = endOfWeek(now, { weekStartsOn: 1 })
    return sessions.filter((s) => s.finishedAt && isWithinInterval(new Date(s.finishedAt), { start, end }))
  }, [sessions])

  const weekVolume = weekSessions.reduce((acc, s) => acc + s.totalVolume, 0)
  const weekTime   = weekSessions.reduce((acc, s) => acc + s.duration, 0)
  const recentSessions = sessions.slice(0, 5)

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  return (
    <div className="px-4 pt-14 pb-4 space-y-5 page-content max-w-lg mx-auto">

      {/* Header */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show"
        className="flex items-start justify-between"
      >
        <div>
          <p className="text-sm text-zinc-500">{greeting},</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {profile?.name ?? 'Atleta'} 👋
          </h1>
        </div>
        <Badge color={AMBER}>
          <Flame size={12} />
          {profile?.streak ?? 0} dias
        </Badge>
      </motion.div>

      {/* Active session banner */}
      {active && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/workouts/execute">
            <Card
              className="p-4 flex items-center gap-3"
              glass
              glow={active.workoutColor}
              pressable
            >
              <div className="rounded-xl p-2.5 flex-none" style={{ background: `${active.workoutColor}18` }}>
                <Play size={17} style={{ color: active.workoutColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
                  Treino em andamento
                </p>
                <p className="font-bold text-white text-sm">{active.workoutName}</p>
              </div>
              <ChevronRight size={16} className="text-zinc-600 flex-none" />
            </Card>
          </Link>
        </motion.div>
      )}

      {/* Level card — glass hero */}
      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
        <Card glass glow={INDIGO} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-0.5">
                Nível {levelInfo.level}
              </p>
              <p className="text-base font-bold text-white">{levelTitle(levelInfo.level)}</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5"
              style={{ background: `${INDIGO}12`, border: `1px solid ${INDIGO}20` }}
            >
              <Zap size={12} style={{ color: INDIGO }} />
              <span className="text-sm font-bold" style={{ color: INDIGO }}>
                {profile?.xp.toLocaleString() ?? 0} XP
              </span>
            </div>
          </div>
          <Progress value={levelInfo.currentXp} max={levelInfo.xpNeeded} color={INDIGO} size="sm" />
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] text-zinc-600">
              {levelInfo.currentXp.toLocaleString()} XP
            </span>
            <span className="text-[11px] text-zinc-600">
              {levelInfo.xpNeeded.toLocaleString()} XP próximo nível
            </span>
          </div>
        </Card>
      </motion.div>

      {/* Weekly stats */}
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Esta semana</h2>
          <span className="text-xs text-zinc-600">{weekSessions.length} treino{weekSessions.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Dumbbell} label="Treinos"   value={`${weekSessions.length}`}    color={INDIGO} />
          <StatCard icon={Weight}   label="Volume"    value={formatVolume(weekVolume)}     color={GREEN}  />
          <StatCard icon={Clock}    label="Tempo"     value={formatDuration(weekTime)}     color={AMBER}  />
        </div>
      </motion.div>

      {/* All-time totals */}
      <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total acumulado</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Trophy}    label="Treinos"       value={`${profile?.totalWorkouts ?? 0}`}                       color={AMBER} />
          <StatCard icon={TrendingUp} label="Volume total" value={formatVolume(profile?.totalVolume ?? 0)}                color={GREEN} />
        </div>
      </motion.div>

      {/* Workout quick-start cards */}
      {workouts.length > 0 && !active && (
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Treinos</h2>
            <Link href="/workouts" className="text-xs font-medium" style={{ color: GREEN }}>
              Ver todos
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {workouts.slice(0, 5).map((w) => (
              <Link key={w.id} href={`/workouts/detail?id=${w.id}`}>
                <motion.div
                  whileTap={{ scale: 0.94 }}
                  className="flex-none w-28 rounded-2xl p-4 flex flex-col gap-3"
                  style={{
                    background: `${w.color}0c`,
                    border: `1px solid ${w.color}1e`,
                  }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: `${w.color}20` }}
                  >
                    <Dumbbell size={15} style={{ color: w.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">{w.name}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{w.exerciseIds.length} exerc.</p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Atividade recente</h2>
          </div>
          <div className="space-y-2">
            {recentSessions.map((s) => {
              const w = workouts.find((x) => x.id === s.workoutId)
              const color = w?.color ?? GREEN
              return (
                <Card key={s.id} className="p-4 flex items-center gap-3">
                  <div className="rounded-xl p-2.5 flex-none" style={{ background: `${color}12` }}>
                    <Dumbbell size={15} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{w?.name ?? 'Treino'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-zinc-500">
                        {s.finishedAt ? formatDate(new Date(s.finishedAt)) : ''}
                      </span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-[11px] text-zinc-500">{formatVolume(s.totalVolume)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-none">
                    <p className="text-xs font-semibold" style={{ color: GREEN }}>+{s.xpEarned} XP</p>
                    <p className="text-[11px] text-zinc-600">{formatDuration(s.duration)}</p>
                  </div>
                </Card>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {workouts.length === 0 && (
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
          <Link href="/workouts/new">
            <Card className="p-8 flex flex-col items-center gap-4 text-center" pressable>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: `${GREEN}12` }}
              >
                <Dumbbell size={28} style={{ color: GREEN }} />
              </div>
              <div>
                <p className="font-bold text-white">Crie seu primeiro treino</p>
                <p className="text-sm text-zinc-500 mt-1">Comece agora e monitore sua evolução</p>
              </div>
            </Card>
          </Link>
        </motion.div>
      )}
    </div>
  )
}
