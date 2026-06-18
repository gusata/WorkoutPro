import { db } from '@/lib/db'
import { generateId } from '@/lib/utils'

export async function seedDemoData() {
  const workoutCount = await db.workouts.count()
  if (workoutCount > 0) return

  const exercises = [
    { id: generateId(), name: 'Supino Reto', muscleGroup: 'Peitoral', notes: '', createdAt: new Date() },
    { id: generateId(), name: 'Crucifixo', muscleGroup: 'Peitoral', notes: '', createdAt: new Date() },
    { id: generateId(), name: 'Tríceps Pulley', muscleGroup: 'Tríceps', notes: '', createdAt: new Date() },
    { id: generateId(), name: 'Desenvolvimento', muscleGroup: 'Ombros', notes: '', createdAt: new Date() },
    { id: generateId(), name: 'Puxada Frontal', muscleGroup: 'Costas', notes: '', createdAt: new Date() },
    { id: generateId(), name: 'Remada Curvada', muscleGroup: 'Costas', notes: '', createdAt: new Date() },
    { id: generateId(), name: 'Rosca Direta', muscleGroup: 'Bíceps', notes: '', createdAt: new Date() },
    { id: generateId(), name: 'Agachamento', muscleGroup: 'Quadríceps', notes: '', createdAt: new Date() },
    { id: generateId(), name: 'Leg Press', muscleGroup: 'Quadríceps', notes: '', createdAt: new Date() },
    { id: generateId(), name: 'Stiff', muscleGroup: 'Posterior', notes: '', createdAt: new Date() },
  ]

  await db.exercises.bulkAdd(exercises as Parameters<typeof db.exercises.bulkAdd>[0])

  const workouts = [
    {
      id: generateId(),
      name: 'Push',
      color: '#6366f1',
      icon: 'Dumbbell',
      exerciseIds: [exercises[0].id, exercises[1].id, exercises[2].id, exercises[3].id],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: generateId(),
      name: 'Pull',
      color: '#10b981',
      icon: 'Dumbbell',
      exerciseIds: [exercises[4].id, exercises[5].id, exercises[6].id],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: generateId(),
      name: 'Legs',
      color: '#f43f5e',
      icon: 'Dumbbell',
      exerciseIds: [exercises[7].id, exercises[8].id, exercises[9].id],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  await db.workouts.bulkAdd(workouts as Parameters<typeof db.workouts.bulkAdd>[0])
}
