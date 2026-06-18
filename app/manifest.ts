import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WorkoutPro',
    short_name: 'WorkoutPro',
    description: 'Seu parceiro de treino premium',
    start_url: '/dashboard/',
    display: 'standalone',
    background_color: '#080809',
    theme_color: '#080809',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['fitness', 'health', 'sports'],
    lang: 'pt-BR',
  }
}
