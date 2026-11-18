import { db } from '@/lib/db'
import type { Exercise, Workout } from '@/types'

// libraryId links each demo exercise to lib/exerciseLibrary.ts (technique, illustrations).
export const EXERCISE_SEEDS = [
  { id: 'demo-exercise-bench-press', name: 'Supino Reto', muscleGroup: 'Peitoral', libraryId: 'supino-reto-barra' },
  { id: 'demo-exercise-chest-fly', name: 'Crucifixo', muscleGroup: 'Peitoral', libraryId: 'crucifixo-reto-halteres' },
  { id: 'demo-exercise-triceps-pushdown', name: 'Tríceps Pulley', muscleGroup: 'Tríceps', libraryId: 'triceps-pulley' },
  { id: 'demo-exercise-shoulder-press', name: 'Desenvolvimento', muscleGroup: 'Ombros', libraryId: 'desenvolvimento-halteres' },
  { id: 'demo-exercise-lat-pulldown', name: 'Puxada Frontal', muscleGroup: 'Costas', libraryId: 'puxada-frontal' },
  { id: 'demo-exercise-bent-row', name: 'Remada Curvada', muscleGroup: 'Costas', libraryId: 'remada-curvada-barra' },
  { id: 'demo-exercise-biceps-curl', name: 'Rosca Direta', muscleGroup: 'Bíceps', libraryId: 'rosca-direta-barra' },
  { id: 'demo-exercise-squat', name: 'Agachamento', muscleGroup: 'Quadríceps', libraryId: 'agachamento-livre' },
  { id: 'demo-exercise-leg-press', name: 'Leg Press', muscleGroup: 'Quadríceps', libraryId: 'leg-press-45' },
  { id: 'demo-exercise-stiff', name: 'Stiff', muscleGroup: 'Posterior', libraryId: 'stiff-barra' },
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
