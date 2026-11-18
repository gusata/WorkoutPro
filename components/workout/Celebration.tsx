'use client'

import { useEffect, useRef, useState } from 'react'

function prefersStill() {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-effects')
}

const COLORS = ['#0071e3', '#30d158', '#ffd60a', '#ff9f0a', '#ff375f', '#bf5af2', '#64d2ff']

interface Piece { x: number; y: number; vx: number; vy: number; size: number; rot: number; vr: number; color: string; shape: 0 | 1; wobble: number }

/** One-shot confetti burst from the top corners. Skipped entirely with reduced motion. */
export function Confetti({ big = false }: { big?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Only mounted after a workout ends (client side), so reading the preference here is safe.
  const [done, setDone] = useState(prefersStill)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ctx = context
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const count = big ? 180 : 110
    const pieces: Piece[] = Array.from({ length: count }, (_, index) => {
      const fromLeft = index % 2 === 0
      const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9
      const speed = 9 + Math.random() * 9
      return {
        x: fromLeft ? -10 : width + 10,
        y: height * 0.35 + Math.random() * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[index % COLORS.length],
        shape: Math.random() > 0.35 ? 0 : 1,
        wobble: Math.random() * Math.PI * 2,
      }
    })

    let raf = 0
    const started = performance.now()
    function draw(now: number) {
      const elapsed = now - started
      ctx.clearRect(0, 0, width, height)
      const fade = elapsed > 2600 ? Math.max(0, 1 - (elapsed - 2600) / 900) : 1
      for (const piece of pieces) {
        piece.vy += 0.32
        piece.vx *= 0.985
        piece.vy *= 0.985
        piece.wobble += 0.12
        piece.x += piece.vx + Math.sin(piece.wobble) * 0.6
        piece.y += piece.vy
        piece.rot += piece.vr
        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(piece.x, piece.y)
        ctx.rotate(piece.rot)
        ctx.fillStyle = piece.color
        if (piece.shape === 0) {
          // Flat ribbon that "flips" as it falls.
          ctx.scale(1, Math.abs(Math.cos(piece.wobble)) * 0.8 + 0.2)
          ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, piece.size / 3, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
      if (fade > 0) raf = requestAnimationFrame(draw)
      else setDone(true)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [big])

  if (done) return null
  return <canvas ref={canvasRef} aria-hidden className="confetti-canvas" />
}

/** Counts from 0 to `value` once, then shows `finalText` (the exact formatted value). */
export function CountUp({ value, format, finalText, duration = 900, delay = 0 }: {
  value: number
  format: (value: number) => string
  finalText: string
  duration?: number
  delay?: number
}) {
  const [current, setCurrent] = useState<number | null>(null)

  useEffect(() => {
    if (prefersStill() || !Number.isFinite(value) || value <= 0) return
    let raf = 0
    let start = 0
    const timer = setTimeout(() => {
      const step = (now: number) => {
        if (!start) start = now
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        setCurrent(t >= 1 ? null : value * eased)
        if (t < 1) raf = requestAnimationFrame(step)
      }
      setCurrent(0)
      raf = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [delay, duration, value])

  // Screen readers always get the final value; the animated digits are decorative.
  if (current === null) return <>{finalText}</>
  return (
    <>
      <span aria-hidden>{format(current)}</span>
      <span className="sr-only">{finalText}</span>
    </>
  )
}
