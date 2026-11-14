import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WorkoutPro',
    short_name: 'WorkoutPro',
    description: 'Planeje treinos, registre series e acompanhe sua evolucao no celular.',
    start_url: '/dashboard/',
    display: 'standalone',
    // Matches the default (light) theme and the splash/status bar before JS runs.
    background_color: '#f2f2f7',
    theme_color: '#f2f2f7',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['fitness', 'health', 'sports'],
    lang: 'pt-BR',
  }
}
