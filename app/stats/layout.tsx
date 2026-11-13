import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Progresso' }

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children
}
