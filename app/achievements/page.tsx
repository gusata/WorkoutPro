'use client'

import { motion } from 'framer-motion'
import { Award, CheckCircle2, Lock, Sparkles, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useProfileStore } from '@/stores/useProfileStore'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: index * 0.035, duration: 0.28, ease: 'easeOut' as const },
  }),
}

export default function AchievementsPage() {
  const { achievements } = useProfileStore()
  const unlockedIds = new Set(achievements.map((achievement) => achievement.id))
  const unlocked = ACHIEVEMENTS.filter((achievement) => unlockedIds.has(achievement.id))
  const locked = ACHIEVEMENTS.filter((achievement) => !unlockedIds.has(achievement.id))
  const pct = ACHIEVEMENTS.length > 0 ? (unlocked.length / ACHIEVEMENTS.length) * 100 : 0

  return (
    <div className="apple-page page-content space-y-5 pb-28">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Progresso</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">Conquistas</h1>
      </header>

      <Card glass className="p-5">
        <div className="flex items-center gap-4">
          <div className="soft-icon flex h-16 w-16 items-center justify-center rounded-[24px]">
            <Trophy size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-bold tracking-tight text-[var(--foreground)]">{Math.round(pct)}%</p>
            <p className="text-sm text-[var(--muted)]">
              {unlocked.length} de {ACHIEVEMENTS.length} desbloqueadas
            </p>
          </div>
        </div>
        <Progress value={pct} max={100} className="mt-5" />
      </Card>

      {unlocked.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[var(--accent)]" />
            <h2 className="apple-section-title">Desbloqueadas</h2>
          </div>

          <div className="space-y-3">
            {unlocked.map((definition, index) => {
              const record = achievements.find((achievement) => achievement.id === definition.id)
              return (
                <motion.div key={definition.id} custom={index} variants={fadeUp} initial="hidden" animate="show">
                  <Card glass className="p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-14 w-14 flex-none items-center justify-center rounded-[22px] text-2xl"
                        style={{ background: `${definition.color}18`, color: definition.color }}
                      >
                        {definition.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[var(--foreground)]">{definition.title}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">{definition.description}</p>
                      </div>
                      {record?.unlockedAt && (
                        <span className="flex-none rounded-full bg-[var(--surface-2)] px-3 py-1 text-[11px] font-bold text-[var(--muted)]">
                          {format(new Date(record.unlockedAt), 'd MMM', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-[var(--muted)]" />
          <h2 className="apple-section-title">Bloqueadas</h2>
        </div>

        <div className="grid gap-3">
          {locked.map((definition, index) => (
            <motion.div
              key={definition.id}
              custom={unlocked.length + index}
              variants={fadeUp}
              initial="hidden"
              animate="show"
            >
              <Card glass className="p-4 opacity-75">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[22px] bg-[var(--surface-2)] text-[var(--muted)]">
                    <Lock size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[var(--foreground)]">{definition.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{definition.description}</p>
                  </div>
                  <Award size={17} className="flex-none text-[var(--muted)]" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <Card glass className="p-4">
        <div className="flex items-center gap-3">
          <div className="soft-icon flex h-11 w-11 items-center justify-center rounded-2xl">
            <Sparkles size={18} />
          </div>
          <p className="text-sm text-[var(--muted)]">
            Continue registrando treinos, volume e sequencias para liberar novas metas.
          </p>
        </div>
      </Card>
    </div>
  )
}
