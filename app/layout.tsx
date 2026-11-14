import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'
import { THEME_BOOTSTRAP_SCRIPT, THEME_COLORS } from '@/lib/theme'
import { AgentationOverlay } from './agentation-overlay'

// SF Pro on Apple devices (system font); Inter, its closest open cousin, everywhere else.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'WorkoutPro', template: '%s | WorkoutPro' },
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
  viewportFit: 'cover',
  // Updated at runtime by the theme bootstrap script / applyTheme().
  themeColor: THEME_COLORS.light,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme and the reduce-effects class are set by the inline script before hydration.
    <html lang="pt-BR" className={inter.variable} data-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <AgentationOverlay />
      </body>
    </html>
  )
}
