export function xpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.4, level - 1))
}

export function totalXpForLevel(level: number): number {
  let total = 0
  for (let i = 1; i < level; i++) {
    total += xpToNextLevel(i)
  }
  return total
}

export function getLevelFromXp(xp: number): { level: number; currentXp: number; xpNeeded: number } {
  let level = 1
  let remaining = xp
  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level)
    level++
    if (level >= 100) break
  }
  return {
    level,
    currentXp: remaining,
    xpNeeded: xpToNextLevel(level),
  }
}

export function xpForWorkout(volume: number, newPrs: number, streakBonus: boolean): number {
  let xp = 50
  xp += Math.floor(volume / 100) * 2
  xp += newPrs * 25
  if (streakBonus) xp += 20
  return xp
}

export function xpForSet(weight: number, reps: number): number {
  return Math.floor((weight * reps) / 50)
}

export function levelTitle(level: number): string {
  if (level < 5) return 'Iniciante'
  if (level < 10) return 'Aprendiz'
  if (level < 20) return 'Atleta'
  if (level < 30) return 'Dedicado'
  if (level < 40) return 'Guerreiro'
  if (level < 50) return 'Expert'
  if (level < 60) return 'Mestre'
  if (level < 75) return 'Elite'
  if (level < 90) return 'Lenda'
  return 'Deus do Ferro'
}
