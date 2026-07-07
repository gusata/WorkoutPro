'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    import('@capacitor/core')
      .then(({ Capacitor }) => {
        if (!Capacitor.isNativePlatform()) return false
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister())
        })
        return true
      })
      .then((isNative) => {
        if (isNative) return
        if (process.env.NODE_ENV === 'production') {
          navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
          return
        }

        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister())
        })
      })
      .catch(() => {})
  }, [])
  return null
}
