'use client'

import { useEffect } from 'react'

export function NativeRuntimeHints() {
  useEffect(() => {
    let active = true

    import('@capacitor/core')
      .then(({ Capacitor }) => {
        if (!active || !Capacitor.isNativePlatform()) return
        document.documentElement.classList.add('native-app')
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  return null
}
