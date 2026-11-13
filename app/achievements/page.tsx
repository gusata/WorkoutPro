'use client'

import { useMemo, useState } from 'react'
import { useProfileStore } from '@/stores/useProfileStore'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { AchievementMedal } from '@/components/achievements/AchievementIcon'
import { Modal } from '@/components/ui/Modal'
import { Hero, LocalNav } from '@/components/layout/PageHeader'
import type { AchievementDef } from '@/types'

export default function AchievementsPage() {
  const achievements = useProfileStore((state) => state.achievements)
  const [selected, setSelected] = useState<AchievementDef | null>(null)
  const records = useMemo(() => new Map(achievements.map((achievement) => [achievement.id, achievement])), [achievements])
  const unlocked = ACHIEVEMENTS.filter((achievement) => records.has(achievement.id))
  const locked = ACHIEVEMENTS.filter((achievement) => !records.has(achievement.id))
  const pct = ACHIEVEMENTS.length > 0 ? Math.round((unlocked.length / ACHIEVEMENTS.length) * 100) : 0
  const selectedRecord = selected ? records.get(selected.id) : undefined

  return (
    <div className="apple-page page-content">
      <LocalNav title="Prêmios" back="/profile" />
      <Hero eyebrow="Conquistas" title="Prêmios." lede={`${unlocked.length} de ${ACHIEVEMENTS.length} conquistados.`}>
        <div className="mt-5 max-w-xs">
          <div className="progress-track" role="progressbar" aria-label="Prêmios conquistados" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Hero>

      {unlocked.length > 0 && <AwardGrid title="Conquistados." items={unlocked} unlocked onSelect={setSelected} dates={records} />}
      <AwardGrid title={unlocked.length > 0 ? 'Próximos.' : 'Todos os prêmios.'} items={locked} unlocked={false} onSelect={setSelected} dates={records} />

      <Modal open={!!selected} onClose={() => setSelected(null)} ariaLabel={selected?.title}>
        {selected && (
          <div className="pb-6 text-center">
            <AchievementMedal icon={selected.icon} color={selected.color} unlocked={Boolean(selectedRecord)} size={140} className="mx-auto" />
            <h2 className="display mt-7">{selected.title}</h2>
            <p className="lede mx-auto mt-2 max-w-xs">{selected.description}</p>
            <p className="eyebrow mt-5">
              {selectedRecord
                ? `Conquistado em ${new Date(selectedRecord.unlockedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Ainda não conquistado'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function AwardGrid({ title, items, unlocked, onSelect, dates }: {
  title: string
  items: AchievementDef[]
  unlocked: boolean
  onSelect: (item: AchievementDef) => void
  dates: Map<string, { unlockedAt: Date }>
}) {
  return (
    <section aria-label={title} className="stack-section">
      <h2 className="section-title mb-5 px-1">{title}</h2>
      <ul className="tile grid grid-cols-3 gap-x-3 gap-y-7">
        {items.map((item) => {
          const record = dates.get(item.id)
          return (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item)} className="pressable flex w-full flex-col items-center text-center">
                <AchievementMedal icon={item.icon} color={item.color} unlocked={unlocked} size={76} />
                <span className="footnote mt-2.5 line-clamp-2 font-semibold">{item.title}</span>
                <span className="caption mt-0.5 line-clamp-2 text-[var(--muted)]">
                  {record ? new Date(record.unlockedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : item.description}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
