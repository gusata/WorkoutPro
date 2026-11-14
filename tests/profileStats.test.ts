import { describe, expect, it } from 'vitest'
import { applySessionToProfile, reconcileProfile } from '@/lib/profileStats'
import { makeProfile, makeSession } from './fixtures'

describe('profileStats', () => {
  it('soma uma sessao e avanca a sequencia em dias consecutivos', () => {
    const profile = makeProfile({
      xp: 80,
      totalVolume: 500,
      totalWorkouts: 1,
      streak: 1,
      longestStreak: 1,
      lastWorkoutDate: new Date('2026-08-18T23:30:00-03:00'),
    })
    const session = makeSession({
      finishedAt: new Date('2026-08-19T00:30:00-03:00'),
      xpEarned: 70,
      totalVolume: 1000,
    })

    const result = applySessionToProfile(profile, session)

    expect(result.totalWorkouts).toBe(2)
    expect(result.totalVolume).toBe(1500)
    expect(result.xp).toBe(150)
    expect(result.level).toBe(2)
    expect(result.streak).toBe(2)
  })

  it('reconstroi totais e sequencias sem depender de milissegundos entre dias', () => {
    const sessions = [
      makeSession({ id: 's1', finishedAt: new Date('2026-03-07T20:00:00-03:00'), xpEarned: 50 }),
      makeSession({ id: 's2', finishedAt: new Date('2026-03-08T20:00:00-03:00'), xpEarned: 60 }),
      makeSession({ id: 's3', finishedAt: new Date('2026-03-09T20:00:00-03:00'), xpEarned: 70 }),
    ]

    const result = reconcileProfile(makeProfile(), sessions, new Date('2026-03-10T08:00:00-03:00'))

    expect(result.totalWorkouts).toBe(3)
    expect(result.xp).toBe(180)
    expect(result.streak).toBe(3)
    expect(result.longestStreak).toBe(3)
  })
})
