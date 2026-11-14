import { describe, expect, it } from 'vitest'
import { parseAppLink, pickWorkoutToStart } from '@/lib/deepLinks'
import { makeSession, makeWorkout } from './fixtures'

describe('parseAppLink', () => {
  it('reconhece os links do widget, atalhos e notificacao', () => {
    expect(parseAppLink('workoutpro://open/dashboard')).toEqual({ kind: 'route', path: '/dashboard' })
    expect(parseAppLink('workoutpro://open/workout')).toEqual({ kind: 'route', path: '/workouts/execute' })
    expect(parseAppLink('workoutpro://open/progress')).toEqual({ kind: 'route', path: '/stats' })
    expect(parseAppLink('workoutpro://open/start')).toEqual({ kind: 'start', workoutId: null })
    expect(parseAppLink('workoutpro://open/start?workout=abc%20123')).toEqual({ kind: 'start', workoutId: 'abc 123' })
    expect(parseAppLink('workoutpro://open/cardio?novo=1')).toEqual({ kind: 'cardio-new' })
    expect(parseAppLink('workoutpro://open/cardio')).toEqual({ kind: 'route', path: '/cardio' })
    expect(parseAppLink('WORKOUTPRO://open/Progress/')).toEqual({ kind: 'route', path: '/stats' })
  })

  it('caminhos desconhecidos abrem o painel; outros links sao ignorados', () => {
    expect(parseAppLink('workoutpro://open/qualquer')).toEqual({ kind: 'route', path: '/dashboard' })
    expect(parseAppLink('workoutpro://open')).toEqual({ kind: 'route', path: '/dashboard' })
    expect(parseAppLink('workoutpro://auth/callback?code=x')).toBeNull()
    expect(parseAppLink('https://example.com/open/start')).toBeNull()
  })
})

describe('pickWorkoutToStart', () => {
  // Wednesday
  const now = new Date(2026, 7, 19, 18, 0)

  it('escolhe o treino planejado para hoje que ainda nao foi feito', () => {
    const workouts = [
      makeWorkout({ id: 'a', scheduledWeekdays: [3] }),
      makeWorkout({ id: 'b', scheduledWeekdays: [3] }),
      makeWorkout({ id: 'c', scheduledWeekdays: [1] }),
    ]
    const sessions = [makeSession({ workoutId: 'a', finishedAt: new Date(2026, 7, 19, 7, 0) })]
    expect(pickWorkoutToStart(workouts, sessions, now, null)?.id).toBe('b')
    expect(pickWorkoutToStart(workouts, [], now, null)?.id).toBe('a')
  })

  it('sem treino planejado devolve nulo; com id pedido usa esse treino', () => {
    const workouts = [makeWorkout({ id: 'a', scheduledWeekdays: [1] })]
    expect(pickWorkoutToStart(workouts, [], now, null)).toBeNull()
    expect(pickWorkoutToStart(workouts, [], now, 'a')?.id).toBe('a')
    expect(pickWorkoutToStart(workouts, [], now, 'missing')).toBeNull()
  })
})
