import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Retrospectiva' }

export default function RecapLayout({ children }: { children: React.ReactNode }) {
  return children
}
