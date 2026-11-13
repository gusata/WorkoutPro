'use client'

import { useSyncExternalStore } from 'react'
import { Agentation } from 'agentation'

const subscribeToNothing = () => () => undefined

export function AgentationOverlay() {
  const interactiveSession = useSyncExternalStore(
    subscribeToNothing,
    () => !navigator.webdriver,
    () => false,
  )

  if (!interactiveSession || process.env.NODE_ENV !== 'development' || process.env.NEXT_PUBLIC_AGENTATION !== '1') {
    return null
  }

  return <Agentation />
}
