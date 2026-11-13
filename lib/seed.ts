import { db } from '@/lib/db'
import type { Exercise, Workout } from '@/types'

const EXERCISE_SEEDS = [
  { id: 'demo-exercise-bench-press', name: 'Supino Reto', muscleGroup: 'Peitoral' },
  { id: 'demo-exercise-chest-fly', name: 'Crucifixo', muscleGroup: 'Peitoral' },
  { id: 'demo-exercise-triceps-pushdown', name: 'Tríceps Pulley', muscleGroup: 'Tríceps' },
  { id: 'demo-exercise-shoulder-press', name: 'Desenvolvimento', muscleGroup: 'Ombros' },
  { id: 'demo-exercise-lat-pulldown', name: 'Puxada Frontal', muscleGroup: 'Costas' },
  { id: 'demo-exercise-bent-row', name: 'Remada Curvada', muscleGroup: 'Costas' },
  { id: 'demo-exercise-biceps-curl', name: 'Rosca Direta', muscleGroup: 'Bíceps' },
  { id: 'demo-exercise-squat', name: 'Agachamento', muscleGroup: 'Quadríceps' },
  { id: 'demo-exercise-leg-press', name: 'Leg Press', muscleGroup: 'Quadríceps' },
  { id: 'demo-exercise-stiff', name: 'Stiff', muscleGroup: 'Posterior' },
] as const

export async function seedDemoData() {
  await db.transaction('rw', [db.workouts, db.exercises], async () => {
    if (await db.workouts.count() > 0) return

    const now = new Date()
    const exercises: Exercise[] = EXERCISE_SEEDS.map((exercise) => ({
      ...exercise,
      notes: '',
      createdAt: now,
      updatedAt: now,
    })) as Exercise[]

    const workouts: Workout[] = [
      {
        id: 'demo-workout-push', name: 'Push', color: '#6366f1', icon: 'Dumbbell',
        exerciseIds: exercises.slice(0, 4).map((exercise) => exercise.id), createdAt: now, updatedAt: now,
      },
      {
        id: 'demo-workout-pull', name: 'Pull', color: '#10b981', icon: 'Dumbbell',
        exerciseIds: exercises.slice(4, 7).map((exercise) => exercise.id), createdAt: now, updatedAt: now,
      },
      {
        id: 'demo-workout-legs', name: 'Legs', color: '#f43f5e', icon: 'Dumbbell',
        exerciseIds: exercises.slice(7, 10).map((exercise) => exercise.id), createdAt: now, updatedAt: now,
      },
    ]

    await db.exercises.bulkPut(exercises)
    await db.workouts.bulkPut(workouts)
  })
}
