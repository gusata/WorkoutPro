'use client'

import { useMemo } from 'react'
import { useHealthStore } from '@/stores/useHealthStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { computeReadiness, computeTrainingLoad } from '@/lib/readiness'
import { isHardSet } from '@/lib/muscleVolume'

/** Today's readiness from the cached watch data and the logged sessions. */
export function useTodayReadiness(now: Date) {
  const sleep = useHealthStore((state) => state.sleep)
  const hrv = useHealthStore((state) => state.hrv)
  const restingHr = useHealthStore((state) => state.restingHr)
  const sessions = useProfileStore((state) => state.sessions)
  const exercises = useWorkoutStore((state) => state.exercises)

  return useMemo(() => {
    const night = sleep.at(-1)
    const recentSets = sessions
      .filter((session) => session.finishedAt && now.getTime() - new Date(session.finishedAt).getTime() < 86_400_000)
      .reduce((total, session) => total + session.exercises.reduce((sum, item) => sum + item.sets.filter(isHardSet).length, 0), 0)
    return computeReadiness({
      hrv,
      restingHr,
      recentSets,
      training: computeTrainingLoad(sessions, exercises, now),
      sleep: night ? { asleep: night.asleep, deep: night.minutes.deep, rem: night.minutes.rem, hasStages: night.hasStages, end: night.end } : null,
      now,
    })
  }, [exercises, hrv, now, restingHr, sessions, sleep])
}
