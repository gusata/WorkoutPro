import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Biblioteca de exercicios' }

export default function ExerciseLibraryLayout({ children }: { children: React.ReactNode }) {
  return children
}
