import { getLevelFromXp } from '@/lib/gamification'
import type { UserProfile, WorkoutSession } from '@/types'

function localDayNumber(value: Date | string): number {
  const date = new Date(value)
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

export function applySessionToProfile(
  profile: UserProfile,
  session: WorkoutSession,
  updatedAt: Date = new Date()
): UserProfile {
  const sessionDay = localDayNumber(session.finishedAt ?? session.startedAt)
  const lastDay = profile.lastWorkoutDate ? localDayNumber(profile.lastWorkoutDate) : null
  let streak = profile.streak
  if (lastDay == null) streak = 1
  else if (sessionDay === lastDay + 1) streak += 1
  else if (sessionDay > lastDay + 1) streak = 1

  const xp = profile.xp + session.xpEarned
  return {
    ...profile,
    totalVolume: profile.totalVolume + session.totalVolume,
    totalWorkouts: profile.totalWorkouts + 1,
    xp,
    level: getLevelFromXp(xp).level,
    streak,
    longestStreak: Math.max(profile.longestStreak, streak),
    lastWorkoutDate: new Date(session.finishedAt ?? session.startedAt),
    updatedAt,
  }
}

export function reconcileProfile(
  profile: UserProfile,
  sessions: WorkoutSession[],
  now: Date = new Date()
): UserProfile {
  const completed = sessions.filter((session) => session.finishedAt)
  const uniqueDays = [...new Set(completed.map((session) => localDayNumber(session.finishedAt!)))].sort((a, b) => a - b)
  let longestStreak = 0
  let run = 0
  let previous: number | null = null
  for (const day of uniqueDays) {
    run = previous != null && day === previous + 1 ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    previous = day
  }

  const today = localDayNumber(now)
  const latestDay = uniqueDays.at(-1) ?? null
  const currentStreak = latestDay != null && today - latestDay <= 1 ? run : 0
  const xp = completed.reduce((total, session) => total + session.xpEarned, 0)
  return {
    ...profile,
    level: getLevelFromXp(xp).level,
    xp,
    totalVolume: completed.reduce((total, session) => total + session.totalVolume, 0),
    totalWorkouts: completed.length,
    streak: currentStreak,
    longestStreak,
    lastWorkoutDate: completed.length > 0
      ? new Date(completed.reduce((latest, session) => {
          const date = new Date(session.finishedAt!)
          return date > latest ? date : latest
        }, new Date(0)))
      : null,
    updatedAt: now,
  }
}
