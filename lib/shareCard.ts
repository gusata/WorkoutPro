/**
 * Renders shareable 1080×1350 cards (Instagram portrait) on a canvas, Apple-keynote style:
 * black stage, huge type, one accent gradient.
 */

export interface ShareStat {
  label: string
  value: string
}

export interface ShareCardData {
  eyebrow: string
  title: string
  subtitle?: string
  stats: ShareStat[]
  highlight?: string
}

const W = 1080
const H = 1350
const FONT = '-apple-system, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif'

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight = 700) {
  let size = startSize
  do {
    ctx.font = `${weight} ${size}px ${FONT}`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 4
  } while (size > 40)
  return size
}

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)

  // Soft spotlight
  const glow = ctx.createRadialGradient(W * 0.8, 80, 40, W * 0.8, 80, 900)
  glow.addColorStop(0, 'rgba(41,151,255,0.35)')
  glow.addColorStop(1, 'rgba(41,151,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const pad = 96
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = '#f5f5f7'
  ctx.font = `600 34px ${FONT}`
  ctx.fillText('WorkoutPro', pad, 140)

  ctx.fillStyle = '#ff9f45'
  ctx.font = `600 36px ${FONT}`
  ctx.fillText(data.eyebrow, pad, 300)

  const titleSize = fitText(ctx, data.title, W - pad * 2, 132)
  const gradient = ctx.createLinearGradient(pad, 0, W - pad, 0)
  gradient.addColorStop(0, '#f5f5f7')
  gradient.addColorStop(1, '#9fc9ff')
  ctx.fillStyle = gradient
  ctx.font = `700 ${titleSize}px ${FONT}`
  ctx.fillText(data.title, pad, 300 + titleSize + 12)

  let y = 300 + titleSize + 12
  if (data.subtitle) {
    ctx.fillStyle = '#a1a1a6'
    ctx.font = `500 40px ${FONT}`
    ctx.fillText(data.subtitle, pad, y + 72)
    y += 72
  }

  // Stats grid (2 columns)
  const top = Math.max(y + 120, 700)
  const colW = (W - pad * 2) / 2
  data.stats.slice(0, 4).forEach((stat, index) => {
    const x = pad + (index % 2) * colW
    const rowY = top + Math.floor(index / 2) * 220
    ctx.fillStyle = '#86868b'
    ctx.font = `500 34px ${FONT}`
    ctx.fillText(stat.label, x, rowY)
    ctx.fillStyle = '#f5f5f7'
    const size = fitText(ctx, stat.value, colW - 40, 88)
    ctx.font = `700 ${size}px ${FONT}`
    ctx.fillText(stat.value, x, rowY + size + 10)
  })

  if (data.highlight) {
    ctx.fillStyle = '#2997ff'
    ctx.font = `600 38px ${FONT}`
    ctx.fillText(data.highlight, pad, H - 120)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem'))), 'image/png')
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Native app: writes the PNG to the cache folder and opens the system share sheet.
 * Browser: Web Share API with files when supported, otherwise downloads the PNG.
 */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const written = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache })
    try {
      await Share.share({ files: [written.uri], text, dialogTitle: 'Compartilhar' })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }

  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text })
      return 'shared'
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
