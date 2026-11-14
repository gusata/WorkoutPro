import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Treino em andamento' }

export default function ExecuteWorkoutLayout({ children }: { children: React.ReactNode }) {
  return children
}
