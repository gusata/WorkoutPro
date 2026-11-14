'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Camera, ChevronsLeftRight, Trash2 } from 'lucide-react'
import { Hero, LocalNav } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useMediaUrl } from '@/components/training/MediaViewer'
import { compressImage, deleteMedia, listMedia, saveMedia } from '@/lib/media'
import type { MediaItem } from '@/types'

function dateLabel(item: MediaItem) {
  return format(new Date(item.createdAt), "d 'de' MMM yyyy", { locale: ptBR })
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<MediaItem[] | null>(null)
  const [before, setBefore] = useState<string | null>(null)
  const [after, setAfter] = useState<string | null>(null)
  const [picking, setPicking] = useState<'before' | 'after' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    const items = await listMedia('photo')
    setPhotos(items)
    return items
  }, [])

  useEffect(() => {
    let cancelled = false
    void listMedia('photo').then((items) => { if (!cancelled) setPhotos(items) })
    return () => { cancelled = true }
  }, [])

  // Default comparison: oldest vs newest.
  const beforeId = before && photos?.some((item) => item.id === before) ? before : photos && photos.length > 1 ? photos.at(-1)!.id : null
  const afterId = after && photos?.some((item) => item.id === after) ? after : photos?.[0]?.id ?? null
  const beforeItem = photos?.find((item) => item.id === beforeId) ?? null
  const afterItem = photos?.find((item) => item.id === afterId) ?? null

  async function addPhoto(file: File | undefined) {
    if (!file) return
    setStatus(null)
    try {
      const blob = await compressImage(file)
      const saved = await saveMedia(blob, 'photo')
      await reload()
      setAfter(saved.id)
      setStatus('Foto salva neste aparelho.')
    } catch {
      setStatus('Não foi possível salvar a foto.')
    }
  }

  return (
    <div className="apple-page page-content">
      <LocalNav
        title="Fotos"
        back="/profile"
        actions={<button type="button" onClick={() => input.current?.click()} className="pill"><Camera size={14} aria-hidden />Adicionar</button>}
      />
      <Hero eyebrow="Progresso" title="Antes e depois." lede="Arraste a linha para comparar. As fotos ficam só neste aparelho." />
      <input ref={input} type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void addPhoto(file) }} />
      {status && <p role="status" className="subhead mt-4 px-1 text-[var(--muted)]">{status}</p>}

      {photos && photos.length === 0 && (
        <div className="tile mt-10 text-center">
          <p className="title-2">Sua primeira foto.</p>
          <p className="subhead mx-auto mt-2 max-w-xs text-[var(--muted)]">Mesmo lugar, mesma luz e mesma pose ajudam a ver a diferença com o tempo.</p>
          <Button className="mt-6" onClick={() => input.current?.click()}><Camera size={16} aria-hidden />Tirar foto</Button>
        </div>
      )}

      {beforeItem && afterItem && beforeItem.id !== afterItem.id && (
        <section className="mt-10" aria-label="Comparação">
          <CompareSlider before={beforeItem} after={afterItem} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="secondary" size="sm" onClick={() => setPicking('before')}>Antes: {dateLabel(beforeItem)}</Button>
            <Button variant="secondary" size="sm" onClick={() => setPicking('after')}>Depois: {dateLabel(afterItem)}</Button>
          </div>
        </section>
      )}

      {photos && photos.length > 0 && (
        <section className="stack-section" aria-labelledby="all-photos">
          <h2 id="all-photos" className="section-title mb-4 px-1">Todas as fotos.</h2>
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((item) => (
              <li key={item.id}>
                <Thumb item={item} onDelete={() => setDeleteTarget(item)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal open={!!picking} onClose={() => setPicking(null)} title={picking === 'before' ? 'Foto de antes' : 'Foto de depois'}>
        <ul className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto">
          {photos?.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="block w-full"
                aria-label={`Usar foto de ${dateLabel(item)}`}
                onClick={() => { if (picking === 'before') setBefore(item.id); else setAfter(item.id); setPicking(null) }}
              >
                <Thumb item={item} />
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir foto">
        <p className="subhead mb-6 text-[var(--muted)]">A foto de {deleteTarget ? dateLabel(deleteTarget) : ''} será apagada deste aparelho.</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={async () => { if (deleteTarget) { await deleteMedia(deleteTarget.id); await reload() } setDeleteTarget(null) }}>Excluir</Button>
        </div>
      </Modal>
    </div>
  )
}

function Thumb({ item, onDelete }: { item: MediaItem; onDelete?: () => void }) {
  const { url } = useMediaUrl(item.id)
  return (
    <figure className="relative">
      <div className="aspect-[3/4] overflow-hidden rounded-[14px] bg-[var(--fill)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
        {url && <img src={url} alt={`Foto de ${dateLabel(item)}`} className="h-full w-full object-cover" />}
      </div>
      <figcaption className="caption mt-1.5 text-center text-[var(--muted)]">{format(new Date(item.createdAt), 'dd/MM/yy')}</figcaption>
      {onDelete && (
        <button type="button" onClick={onDelete} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white" aria-label={`Excluir foto de ${dateLabel(item)}`}>
          <Trash2 size={15} aria-hidden />
        </button>
      )}
    </figure>
  )
}

/** Before/after reveal. A native range input drives it, so it works with touch, mouse, keyboard and screen readers. */
function CompareSlider({ before, after }: { before: MediaItem; after: MediaItem }) {
  const [position, setPosition] = useState(50)
  const { url: beforeUrl } = useMediaUrl(before.id)
  const { url: afterUrl } = useMediaUrl(after.id)
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-md select-none overflow-hidden rounded-[var(--radius-xl)] bg-[var(--fill)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      {afterUrl && <img src={afterUrl} alt={`Depois, ${dateLabel(after)}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
        {beforeUrl && <img src={beforeUrl} alt={`Antes, ${dateLabel(before)}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
      </div>
      <div aria-hidden className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)]" style={{ left: `${position}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg"><ChevronsLeftRight size={18} /></span>
      </div>
      <span aria-hidden className="caption absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-semibold text-white">Antes</span>
      <span aria-hidden className="caption absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-semibold text-white">Depois</span>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label="Comparar antes e depois"
        aria-valuetext={`${position}% da foto de antes visível`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  )
}
