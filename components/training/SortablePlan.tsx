'use client'

import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragStartEvent, type Modifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, Dumbbell, GripVertical, Link2, Trash2 } from 'lucide-react'
import { Stepper } from '@/components/ui/Stepper'
import { SwipeRow } from '@/components/ui/SwipeRow'
import { getLibraryExercise, libraryImageUrls } from '@/lib/exerciseLibrary'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import type { Exercise, WorkoutExerciseConfig } from '@/types'

interface SortablePlanProps {
  exercises: Exercise[]
  configFor: (exerciseId: string) => WorkoutExerciseConfig
  onReorder: (ids: string[]) => void
  onChangeConfig: (exerciseId: string, updates: Partial<WorkoutExerciseConfig>) => void
  onToggleSuperset: (exerciseId: string, index: number) => void
  onRemove: (exercise: Exercise) => void
}

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

export function SortablePlan({ exercises, configFor, onReorder, onChangeConfig, onToggleSuperset, onRemove }: SortablePlanProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    // Only the grip starts a drag, so a short distance is enough and scrolling stays free.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = exercises.map((exercise) => exercise.id)
  const nameOf = (id: string | number) => exercises.find((exercise) => exercise.id === id)?.name ?? 'exercício'
  const positionOf = (id: string | number | undefined) => (id == null ? 0 : ids.indexOf(String(id)) + 1)
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${nameOf(active.id)} pego, posição ${positionOf(active.id)} de ${ids.length}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} na posição ${positionOf(over.id)} de ${ids.length}.` : ''),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} solto na posição ${positionOf(over.id)}.` : `${nameOf(active.id)} solto.`),
    onDragCancel: ({ active }) => `Movimento cancelado. ${nameOf(active.id)} voltou ao lugar.`,
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
    setExpanded(null)
    document.documentElement.classList.add('dragging-active')
    haptic('medium')
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    document.documentElement.classList.remove('dragging-active')
    const { active, over } = event
    if (!over || active.id === over.id) return
    haptic('light')
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  const activeExercise = exercises.find((exercise) => exercise.id === activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: 'Para mover, pressione espaço ou enter, use as setas e pressione espaço de novo para soltar. Esc cancela.' },
      }}
      onDragStart={onDragStart}
      onDragOver={({ over }) => { if (over) haptic('selection') }}
      onDragEnd={onDragEnd}
      onDragCancel={() => { setActiveId(null); document.documentElement.classList.remove('dragging-active') }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="list">
          {exercises.map((exercise, index) => {
            const config = configFor(exercise.id)
            const prev = index > 0 ? configFor(exercises[index - 1].id).supersetId : null
            const next = index < exercises.length - 1 ? configFor(exercises[index + 1].id).supersetId : null
            return (
              <PlanRow
                key={exercise.id}
                exercise={exercise}
                index={index}
                config={config}
                linkedAbove={Boolean(config.supersetId && prev === config.supersetId)}
                linkedBelow={Boolean(config.supersetId && next === config.supersetId)}
                open={expanded === exercise.id}
                onToggle={() => setExpanded((current) => (current === exercise.id ? null : exercise.id))}
                onChangeConfig={(updates) => onChangeConfig(exercise.id, updates)}
                onToggleSuperset={() => onToggleSuperset(exercise.id, index)}
                onRemove={() => onRemove(exercise)}
              />
            )
          })}
        </div>
      </SortableContext>
      {typeof document !== 'undefined' && createPortal(<DragOverlay dropAnimation={{ duration: 260, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }}>
        {activeExercise ? (
          <div className="flex scale-[1.03] items-center gap-3 rounded-[var(--radius-md)] bg-[var(--background-elevated)] py-3 pl-4 pr-3 shadow-[var(--shadow-float)] ring-[0.5px] ring-[var(--glass-edge)]">
            <Thumb exercise={activeExercise} />
            <span className="min-w-0 flex-1">
              <span className="headline block truncate">{activeExercise.name}</span>
              <span className="footnote text-[var(--muted)]">{activeExercise.muscleGroup}</span>
            </span>
            <GripVertical size={18} className="text-[var(--accent)]" aria-hidden />
          </div>
        ) : null}
      </DragOverlay>, document.body)}
    </DndContext>
  )
}

function Thumb({ exercise }: { exercise: Exercise }) {
  const item = getLibraryExercise(exercise.libraryId)
  const urls = item ? libraryImageUrls(item) : null
  const [failed, setFailed] = useState(false)
  if (!urls || failed) {
    return <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-[var(--fill)] text-[var(--muted)]"><Dumbbell size={18} /></span>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote public-domain photo; static export has no image optimizer
    <img
      src={urls[1]}
      alt=""
      aria-hidden
      draggable={false}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-11 w-11 flex-none rounded-[12px] bg-white object-cover"
    />
  )
}

interface PlanRowProps {
  exercise: Exercise
  index: number
  config: WorkoutExerciseConfig
  linkedAbove: boolean
  linkedBelow: boolean
  open: boolean
  onToggle: () => void
  onChangeConfig: (updates: Partial<WorkoutExerciseConfig>) => void
  onToggleSuperset: () => void
  onRemove: () => void
}

function PlanRow({ exercise, index, config, linkedAbove, linkedBelow, open, onToggle, onChangeConfig, onToggleSuperset, onRemove }: PlanRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id })
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition }
  const panelId = `plan-${exercise.id}`

  return (
    <div ref={setNodeRef} style={style} className={cn('grouped-row sortable-row', isDragging && 'opacity-30')}>
      <SwipeRow actions={[{ label: 'Remover', icon: <Trash2 size={18} aria-hidden />, tone: 'danger', onAction: onRemove }]} disabled={isDragging}>
        <div className="relative flex items-center gap-3 py-2.5 pl-4 pr-1">
          {config.supersetId && (
            <span aria-hidden className="superset-rail" style={{ top: linkedAbove ? 0 : '30%', bottom: linkedBelow ? 0 : '30%', left: 4 }} />
          )}
          <span className="relative flex-none">
            <Thumb exercise={exercise} />
            <span aria-hidden className="numeric absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--foreground)] px-1 text-[11px] font-bold text-[var(--background-elevated)]">{index + 1}</span>
          </span>
          <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 text-left">
            <span className="min-w-0 flex-1">
              <span className="headline block truncate">{exercise.name}</span>
              <span className="footnote flex items-center gap-1 text-[var(--muted)]">
                <span className="numeric">{config.targetSets} × {config.minReps}–{config.maxReps} · {config.restSeconds}s</span>
                {config.supersetId && <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--accent)]"><Link2 size={12} aria-hidden />Supersérie</span>}
              </span>
            </span>
            <ChevronDown size={17} aria-hidden className={cn('flex-none text-[var(--muted)] transition-transform duration-300', open && 'rotate-180')} />
          </button>
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            data-no-swipe
            className="drag-handle flex h-12 w-10 flex-none items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label={`Arrastar para reordenar ${exercise.name}`}
          >
            <GripVertical size={20} aria-hidden />
          </button>
        </div>
      </SwipeRow>
      <div className="collapsible" data-open={open}>
        <div id={panelId} inert={!open}>
          <div className="border-t border-[var(--separator)] bg-[var(--surface-2)] px-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              <Stepper label="Séries" value={config.targetSets} max={12} onChange={(value) => onChangeConfig({ targetSets: value })} />
              <Stepper label="Pausa (s)" value={config.restSeconds} step={15} min={15} max={600} onChange={(value) => onChangeConfig({ restSeconds: value })} />
              <Stepper label="Reps mín." value={config.minReps} max={config.maxReps} onChange={(value) => onChangeConfig({ minReps: value })} />
              <Stepper label="Reps máx." value={config.maxReps} min={config.minReps} max={100} onChange={(value) => onChangeConfig({ maxReps: value })} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={onToggleSuperset} aria-pressed={Boolean(config.supersetId)} className="chip"><Link2 size={15} aria-hidden />Supersérie</button>
              <Link href={`/exercises/detail?id=${exercise.id}`} className="link px-2 text-[15px]">Histórico e força<ChevronRight size={15} aria-hidden /></Link>
              <button type="button" onClick={onRemove} className="ml-auto flex min-h-11 items-center gap-1 rounded-full px-2 text-[15px] text-[var(--danger)]"><Trash2 size={15} aria-hidden />Remover</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
