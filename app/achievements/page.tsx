'use client'

import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { Card } from '@/components/ui/Card'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const GREEN = '#00c896'

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.32, ease: 'easeOut' as const },
  }),
}

export default function AchievementsPage() {
  const { achievements } = useProfileStore()
  const unlockedIds  = new Set(achievements.map((a) => a.id))
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id)).length
  const pct = (unlockedCount / ACHIEVEMENTS.length) * 100

  return (
    <div className="px-4 pt-14 pb-4 page-content max-w-lg mx-auto">
      <div className="mb-5">
        <p className="text-xs text-zinc-500">Suas</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">Conquistas</h1>
      </div>

      {/* Progress bar */}
      <Card glass className="p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-white">
            {unlockedCount} / {ACHIEVEMENTS.length} desbloqueadas
          </span>
          <span className="text-sm font-bold" style={{ color: GREEN }}>
            {Math.round(pct)}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${GREEN}, #00a87c)` }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' as const }}
          />
        </div>
      </Card>

      {/* Unlocked */}
      {unlockedCount > 0 && (
        <div className="mb-6">
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Desbloqueadas
          </h2>
          <div className="space-y-2">
            {ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id)).map((def, i) => {
              const record = achievements.find((a) => a.id === def.id)
              return (
                <motion.div key={def.id} custom={i} variants={fadeUp} initial="hidden" animate="show">
                  <Card className="p-4 flex items-center gap-4" glow={def.color}>
                    <motion.div
                      initial={{ scale: 0.5, rotate: -15 }}
                      animate={{ scale: 1,   rotate: 0   }}
                      transition={{ delay: i * 0.05, type: 'spring', damping: 14 }}
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-none"
                      style={{
                        background: `${def.color}18`,
                        border: `1px solid ${def.color}28`,
                      }}
                    >
                      {def.icon}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm">{def.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{def.description}</p>
                    </div>
                    {record?.unlockedAt && (
                      <p className="text-[11px] text-zinc-600 flex-none">
                        {format(new Date(record.unlockedAt), 'd MMM', { locale: ptBR })}
                      </p>
                    )}
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Locked */}
      <div>
        <h2 className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-3">
          Bloqueadas
        </h2>
        <div className="space-y-2">
          {ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id)).map((def, i) => (
            <motion.div
              key={def.id}
              custom={unlockedCount + i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
            >
              <Card className="p-4 flex items-center gap-4" style={{ opacity: 0.45 }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <Lock size={16} className="text-zinc-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-zinc-400 text-sm">{def.title}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{def.description}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
