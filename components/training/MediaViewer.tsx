'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { getMedia } from '@/lib/media'

/** Object URL for a locally stored blob, revoked when the component unmounts. */
export function useMediaUrl(mediaId: string | null | undefined) {
  const [state, setState] = useState<{ id: string; url: string | null; missing: boolean } | null>(null)

  useEffect(() => {
    if (!mediaId) return
    let url: string | null = null
    let cancelled = false
    void getMedia(mediaId).then((item) => {
      if (cancelled) return
      if (!item) { setState({ id: mediaId, url: null, missing: true }); return }
      url = URL.createObjectURL(item.blob)
      setState({ id: mediaId, url, missing: false })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [mediaId])

  const current = state && state.id === mediaId ? state : null
  return { url: current?.url ?? null, missing: current?.missing ?? false }
}

export function VideoModal({ mediaId, title, onClose }: { mediaId: string | null; title: string; onClose: () => void }) {
  const { url, missing } = useMediaUrl(mediaId)
  return (
    <Modal open={!!mediaId} onClose={onClose} title={title}>
      {missing ? (
        <p className="subhead pb-4 text-[var(--muted)]">Este vídeo não está neste aparelho. Vídeos ficam só no celular onde foram gravados.</p>
      ) : url ? (
        <video src={url} controls playsInline className="max-h-[70vh] w-full rounded-[var(--radius-md)] bg-black" />
      ) : (
        <div className="aspect-video w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--fill)]" />
      )}
    </Modal>
  )
}
