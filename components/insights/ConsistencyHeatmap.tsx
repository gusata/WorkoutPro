'use client'

import { useMemo } from 'react'
import { addDays, format, isAfter, startOfWeek, subWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { heatLevel } from '@/lib/insights'

const ROW_LABELS = ['S', '', 'Q', '', 'S', '', 'D']
const CELL = 13
const GAP = 3
const LABEL_W = 12

/** GitHub-style contribution grid: one column per week, Monday at the top. */
export function ConsistencyHeatmap({ setsByDay, weeks = 26, now = new Date() }: { setsByDay: Map<string, number>; weeks?: number; now?: Date }) {
  const columns = useMemo(() => {
    const firstWeek = startOfWeek(subWeeks(now, weeks - 1), { weekStartsOn: 1 })
    return Array.from({ length: weeks }, (_, column) => Array.from({ length: 7 }, (_, row) => {
      const day = addDays(firstWeek, column * 7 + row)
      const key = format(day, 'yyyy-MM-dd')
      return { day, key, sets: setsByDay.get(key) ?? 0, future: isAfter(day, now) }
    }))
  }, [now, setsByDay, weeks])

  const activeDays = columns.flat().filter((cell) => cell.sets > 0 && !cell.future).length
  // Month labels where a month starts, skipping ones too close to the previous label.
  let lastMark = -10
  const monthMarks = columns.map((column, index) => {
    const first = column[0].day
    const previous = index > 0 ? columns[index - 1][0].day : null
    const starts = previous && previous.getMonth() !== first.getMonth()
    if (!starts || index - lastMark < 3) return ''
    lastMark = index
    return format(first, 'MMM', { locale: ptBR }).replace('.', '')
  })

  return (
    <figure>
      <figcaption className="sr-only">{activeDays} dias com treino nas últimas {weeks} semanas.</figcaption>
      <svg aria-hidden viewBox={`0 0 ${LABEL_W + weeks * CELL} ${7 * CELL + 16}`} className="h-auto w-full overflow-visible">
        {ROW_LABELS.map((label, index) => label && (
          <text key={index} x={0} y={index * CELL + (CELL - GAP) / 2 + 3} fontSize="8.5" fill="var(--muted)">{label}</text>
        ))}
        {columns.map((column, x) => column.map((cell, y) => cell.future ? null : (
          <rect key={cell.key} x={LABEL_W + x * CELL} y={y * CELL} width={CELL - GAP} height={CELL - GAP} rx={2} fill={`var(--heat-${heatLevel(cell.sets)})`}>
            <title>{`${format(cell.day, "d 'de' MMM", { locale: ptBR })}: ${cell.sets} séries`}</title>
          </rect>
        )))}
        {monthMarks.map((mark, x) => mark && (
          <text key={x} x={LABEL_W + x * CELL} y={7 * CELL + 11} fontSize="8.5" fill="var(--muted)" style={{ textTransform: 'capitalize' }}>{mark}</text>
        ))}
      </svg>
      <div aria-hidden className="mt-3 flex items-center justify-end gap-1.5">
        <span className="caption text-[var(--muted)]">Menos</span>
        {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`heat-${level} h-2.5 w-2.5 rounded-[3px]`} />)}
        <span className="caption text-[var(--muted)]">Mais</span>
      </div>
    </figure>
  )
}
