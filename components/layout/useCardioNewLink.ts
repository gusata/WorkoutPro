'use client'

import { useEffect, useRef } from 'react'
import { CARDIO_NEW_EVENT } from '@/lib/deepLinks'

/**
 * "Registrar cardio" launcher shortcut: opens the form when the page is reached with
 * ?novo=1, or when the link arrives while the page is already open.
 */
export function useCardioNewLink(open: () => void) {
  const openRef = useRef(open)
  useEffect(() => { openRef.current = open }, [open])

  useEffect(() => {
    const run = () => openRef.current()
    let timer: ReturnType<typeof setTimeout> | undefined
    const params = new URLSearchParams(window.location.search)
    if (params.get('novo') === '1') {
      params.delete('novo')
      const query = params.toString()
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
      timer = setTimeout(run, 0)
    }
    window.addEventListener(CARDIO_NEW_EVENT, run)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener(CARDIO_NEW_EVENT, run)
    }
  }, [])
}
