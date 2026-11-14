/**
 * Bridge between the active session (Zustand stores) and the Wear OS companion app.
 *
 * Phone -> watch: a JSON snapshot of "what now" is published as the /workout/state DataItem
 * (debounced, deduplicated). Watch -> phone: MessageClient messages land in a native queue
 * (SharedPreferences) and are drained here and applied through the regular store actions, so a
 * set logged on the watch behaves exactly like a tap on the phone.
 */
import type { PluginListenerHandle } from '@capacitor/core'
import type { ActiveSession, Exercise, Workout, WorkoutSession } from '@/types'
import type { NativeWearAction, WearBridgePluginInterface } from '@/lib/wearPlugin'
import { workoutsForWeekday } from '@/lib/reminders'

export const WEAR_STATE_VERSION = 1
export const DEFAULT_WEIGHT_STEP = 2.5
export const PUSH_DEBOUNCE_MS = 300
/** set-done / rest / finish older than this are not applied (the phone was off for hours). */
const MAX_ACTION_AGE_MS = 6 * 60 * 60 * 1000
/** A "start today's workout" request only makes sense right after it was made. */
const MAX_START_AGE_MS = 10 * 60 * 1000

export interface WearNextSet {
  exerciseName: string
  setIndex: number
  setCount: number
  weight: number
  reps: number
}

export interface WearState {
  v: number
  active: boolean
  sessionId: string | null
  workoutName: string
  startedAt: number | null
  exerciseId: string | null
  exerciseName: string
  setId: string | null
  /** 0-based index of the current set inside its exercise. */
  setIndex: number
  setCount: number
  setType: string
  targetWeight: number
  targetReps: number
  targetMinReps: number | null
  targetMaxReps: number | null
  previousWeight: number | null
  previousReps: number | null
  weightStep: number
  restSeconds: number
  /** Phone wall-clock ms when the running rest ends; null when not resting. */
  restEndAt: number | null
  restTotal: number
  doneSets: number
  totalSets: number
  allDone: boolean
  next: WearNextSet | null
}

export interface TimerSnapshot {
  restRunning: boolean
  restEndAt: number | null
  restTotal: number
}

const INACTIVE: WearState = {
  v: WEAR_STATE_VERSION, active: false, sessionId: null, workoutName: '', startedAt: null,
  exerciseId: null, exerciseName: '', setId: null, setIndex: 0, setCount: 0, setType: 'normal',
  targetWeight: 0, targetReps: 0, targetMinReps: null, targetMaxReps: null,
  previousWeight: null, previousReps: null, weightStep: DEFAULT_WEIGHT_STEP, restSeconds: 0,
  restEndAt: null, restTotal: 0, doneSets: 0, totalSets: 0, allDone: false, next: null,
}

function stepsOf(active: ActiveSession) {
  return active.exercises.flatMap((exercise) => exercise.sets.map((set, index) => ({ exercise, set, index })))
}

/** Pure: the snapshot the watch renders. Order matches the phone's live notification. */
export function buildWearState(active: ActiveSession | null, timer: TimerSnapshot): WearState {
  if (!active) return INACTIVE
  const steps = stepsOf(active)
  const pendingIndex = steps.findIndex((step) => !step.set.completed)
  const current = pendingIndex >= 0 ? steps[pendingIndex] : undefined
  const nextStep = pendingIndex >= 0 ? steps.slice(pendingIndex + 1).find((step) => !step.set.completed) : undefined
  const restEndAt = timer.restRunning && timer.restEndAt != null ? timer.restEndAt : null
  const increment = current?.exercise.progression?.increment
  const previous = current ? current.exercise.previousSets?.[current.index] : undefined
  // Without a pending set the watch still shows the last exercise rest/next preview.
  const restSource = current?.exercise ?? steps.at(-1)?.exercise

  return {
    ...INACTIVE,
    active: true,
    sessionId: active.sessionId,
    workoutName: active.workoutName,
    startedAt: new Date(active.startedAt).getTime(),
    exerciseId: current?.exercise.exerciseId ?? null,
    exerciseName: current?.exercise.exerciseName ?? '',
    setId: current?.set.id ?? null,
    setIndex: current?.index ?? 0,
    setCount: current?.exercise.sets.length ?? 0,
    setType: current?.set.setType ?? 'normal',
    targetWeight: current?.set.weight ?? 0,
    targetReps: current?.set.reps ?? 0,
    targetMinReps: current?.exercise.targetMinReps ?? null,
    targetMaxReps: current?.exercise.targetMaxReps ?? null,
    previousWeight: previous?.weight ?? null,
    previousReps: previous?.reps ?? null,
    weightStep: increment && increment > 0 ? increment : DEFAULT_WEIGHT_STEP,
    restSeconds: restSource?.restSeconds ?? 90,
    restEndAt,
    restTotal: restEndAt != null ? timer.restTotal : 0,
    doneSets: steps.filter((step) => step.set.completed).length,
    totalSets: steps.length,
    allDone: steps.length > 0 && pendingIndex < 0,
    next: nextStep
      ? {
          exerciseName: nextStep.exercise.exerciseName,
          setIndex: nextStep.index,
          setCount: nextStep.exercise.sets.length,
          weight: nextStep.set.weight,
          reps: nextStep.set.reps,
        }
      : null,
  }
}

/** Debounces pushes and skips identical snapshots (DataClient would wake the watch for nothing). */
export function createStatePusher(push: (json: string) => Promise<void> | void, delay = PUSH_DEBOUNCE_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: string | null = null
  let lastSent: string | null = null

  function flush() {
    if (timer) clearTimeout(timer)
    timer = undefined
    if (pending == null || pending === lastSent) { pending = null; return }
    const json = pending
    pending = null
    lastSent = json
    Promise.resolve(push(json)).catch(() => {
      // Let the next change (or a forced resend) try again.
      if (lastSent === json) lastSent = null
    })
  }

  return {
    schedule(state: WearState) {
      pending = JSON.stringify(state)
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    flush,
    /** Forget the last snapshot so the next schedule is sent even if unchanged (app resumed). */
    invalidate() { lastSent = null },
    dispose() {
      if (timer) clearTimeout(timer)
      timer = undefined
      pending = null
    },
  }
}

export type WearAction =
  | { type: 'set-done'; id?: string; sessionId?: string; exerciseId?: string; setId?: string; weight: number; reps: number; receivedAt: number }
  | { type: 'rest'; id?: string; sessionId?: string; op: 'extend' | 'skip'; seconds: number; receivedAt: number }
  | { type: 'start'; id?: string; receivedAt: number }
  | { type: 'finish'; id?: string; sessionId?: string; receivedAt: number }

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined
}

/** Validates what the native queue hands over; malformed messages are dropped. */
export function parseNativeAction(raw: NativeWearAction): WearAction | null {
  let data: Record<string, unknown> = {}
  try {
    const parsed: unknown = raw.payload ? JSON.parse(raw.payload) : {}
    if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>
  } catch {
    return null
  }
  const receivedAt = finiteNumber(raw.receivedAt) ?? Date.now()
  const base = { id: optionalString(data.id), receivedAt }
  switch (raw.type) {
    case 'set-done': {
      const weight = finiteNumber(data.weight)
      const reps = finiteNumber(data.reps)
      if (weight == null || reps == null || weight < 0 || reps < 0) return null
      return {
        ...base, type: 'set-done', sessionId: optionalString(data.sessionId),
        exerciseId: optionalString(data.exerciseId), setId: optionalString(data.setId),
        weight: Math.round(weight * 100) / 100, reps: Math.round(reps),
      }
    }
    case 'rest': {
      const op = data.op === 'skip' ? 'skip' : data.op === 'extend' ? 'extend' : null
      if (!op) return null
      const seconds = finiteNumber(data.seconds) ?? 15
      return { ...base, type: 'rest', sessionId: optionalString(data.sessionId), op, seconds: Math.max(-600, Math.min(600, seconds)) }
    }
    case 'start':
      return { ...base, type: 'start' }
    case 'finish':
      return { ...base, type: 'finish', sessionId: optionalString(data.sessionId) }
    default:
      return null
  }
}

/** Same rule as the dashboard: a workout scheduled today (not done yet today) wins, else the oldest one. */
export function pickTodaysWorkout(workouts: Workout[], exercises: Exercise[], sessions: WorkoutSession[], now = new Date()) {
  if (!workouts.length) return null
  const finished = (session: WorkoutSession | undefined) => (session?.finishedAt ? new Date(session.finishedAt) : null)
  const lastByWorkout = new Map<string, WorkoutSession>()
  for (const session of sessions) {
    if (!session.finishedAt) continue
    const current = lastByWorkout.get(session.workoutId)
    if (!current || new Date(session.finishedAt) > new Date(current.finishedAt!)) lastByWorkout.set(session.workoutId, session)
  }
  const sameDay = (a: Date | null, b: Date) => !!a && a.toDateString() === b.toDateString()
  const byAge = [...workouts].sort((a, b) =>
    (finished(lastByWorkout.get(a.id))?.getTime() ?? 0) - (finished(lastByWorkout.get(b.id))?.getTime() ?? 0)
  )
  const scheduledToday = workoutsForWeekday(workouts, now.getDay())
    .find((workout) => !sameDay(finished(lastByWorkout.get(workout.id)), now))
  const workout = scheduledToday ?? byAge[0]
  const byId = new Map(exercises.map((item) => [item.id, item]))
  const list = workout.exerciseIds.map((id) => byId.get(id)).filter((item): item is Exercise => Boolean(item))
  return { workout, exercises: list }
}

/** Store operations the bridge needs; injected so the logic is testable without Capacitor. */
export interface WearBridgeDeps {
  getActive: () => ActiveSession | null
  getTimer: () => TimerSnapshot
  updateSet: (exerciseId: string, setId: string, updates: { weight: number; reps: number }) => void
  completeSet: (exerciseId: string, setId: string) => void
  startRest: (seconds: number) => void
  extendRest: (seconds: number) => void
  stopRest: () => void
  startTodaysWorkout: () => Promise<boolean>
  finishSession: () => Promise<void>
}

export type ApplyResult = 'applied' | 'ignored'

/** Applies one watch action through the regular store actions. */
export async function applyWearAction(action: WearAction, deps: WearBridgeDeps, now = Date.now()): Promise<ApplyResult> {
  const age = now - action.receivedAt
  const active = deps.getActive()

  if (action.type === 'start') {
    if (age > MAX_START_AGE_MS || active) return 'ignored'
    return (await deps.startTodaysWorkout()) ? 'applied' : 'ignored'
  }

  if (!active || age > MAX_ACTION_AGE_MS) return 'ignored'
  // An action meant for another (older) session must never touch this one.
  if (action.sessionId && action.sessionId !== active.sessionId) return 'ignored'

  if (action.type === 'set-done') {
    const steps = stepsOf(active)
    const target = steps.find((step) =>
      !step.set.completed && step.exercise.exerciseId === action.exerciseId && step.set.id === action.setId
    ) ?? steps.find((step) => !step.set.completed)
    if (!target) return 'ignored'
    deps.updateSet(target.exercise.exerciseId, target.set.id, { weight: action.weight, reps: action.reps })
    deps.completeSet(target.exercise.exerciseId, target.set.id)
    deps.startRest(target.exercise.restSeconds)
    return 'applied'
  }

  if (action.type === 'rest') {
    if (!deps.getTimer().restRunning) return 'ignored'
    if (action.op === 'skip') deps.stopRest()
    else deps.extendRest(action.seconds)
    return 'applied'
  }

  await deps.finishSession()
  return 'applied'
}

/** Remembers recently applied ids so a message delivered twice is applied once. */
export function createActionDeduper(limit = 50) {
  const seen: string[] = []
  return (id: string | undefined) => {
    if (!id) return true
    if (seen.includes(id)) return false
    seen.push(id)
    if (seen.length > limit) seen.shift()
    return true
  }
}

export interface WearBridgeOptions {
  plugin: WearBridgePluginInterface
  deps: WearBridgeDeps
  /** Subscribes to store changes; returns the unsubscribe function. */
  subscribe: (onChange: () => void) => () => void
  debounceMs?: number
}

/** Wires everything up; returns a cleanup function. */
export function startWearBridge({ plugin, deps, subscribe, debounceMs = PUSH_DEBOUNCE_MS }: WearBridgeOptions) {
  const pusher = createStatePusher((json) => plugin.pushState({ json }), debounceMs)
  const isNew = createActionDeduper()
  let disposed = false
  let draining: Promise<void> | null = null
  let again = false

  const schedule = () => { if (!disposed) pusher.schedule(buildWearState(deps.getActive(), deps.getTimer())) }

  async function drainOnce() {
    const { actions } = await plugin.drainActions()
    for (const raw of actions ?? []) {
      const action = parseNativeAction(raw)
      if (!action || !isNew(action.id)) continue
      try {
        await applyWearAction(action, deps)
      } catch {
        // One bad action must not block the rest of the queue.
      }
    }
  }

  function drain(): Promise<void> {
    if (disposed) return Promise.resolve()
    if (draining) { again = true; return draining }
    draining = (async () => {
      try {
        do {
          again = false
          await drainOnce()
        } while (again && !disposed)
      } catch {
        // Native side unavailable: nothing to apply.
      } finally {
        draining = null
        // The watch may have shown an optimistic screen: always resend the truth.
        pusher.invalidate()
        schedule()
      }
    })()
    return draining
  }

  const unsubscribe = subscribe(schedule)
  let listener: PluginListenerHandle | null = null
  plugin.addListener('actionsAvailable', () => { void drain() })
    .then((handle) => { if (disposed) void handle.remove(); else listener = handle })
    .catch(() => undefined)

  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      pusher.invalidate()
      void drain()
    }
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)

  pusher.invalidate()
  schedule()
  void drain()

  return {
    drain,
    flush: () => pusher.flush(),
    stop() {
      disposed = true
      unsubscribe()
      pusher.dispose()
      void listener?.remove()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
    },
  }
}
