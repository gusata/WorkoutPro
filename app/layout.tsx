import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'WorkoutPro',
  description: 'Planeje treinos, registre series e acompanhe sua evolucao no celular.',
  manifest: '/manifest.webmanifest',
  applicationName: 'WorkoutPro',
  authors: [{ name: 'WorkoutPro' }],
  keywords: ['treino', 'musculacao', 'fitness', 'progresso', 'academia'],
  openGraph: {
    title: 'WorkoutPro',
    description: 'Planeje treinos, registre series e acompanhe sua evolucao no celular.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'WorkoutPro',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WorkoutPro',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#f5f6f7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={geist.variable} data-theme="light">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
