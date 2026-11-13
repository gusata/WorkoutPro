'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface LocalNavProps {
  title: string
  /** Shows a back button; a string is used as the fallback route when there is no history. */
  back?: boolean | string
  /** Right-aligned actions (pills, icon buttons). */
  actions?: React.ReactNode
  /** Keeps the bar transparent until the page scrolls (for pages with a big hero). */
  transparentUntilScroll?: boolean
  className?: string
}

/**
 * Sticky product sub-navigation from apple.com: title on the left, a small blue
 * pill on the right, frosted once content scrolls underneath.
 */
export function LocalNav({ title, back, actions, transparentUntilScroll = true, className }: LocalNavProps) {
  const router = useRouter()
  const sentinel = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(!transparentUntilScroll)

  useEffect(() => {
    if (!transparentUntilScroll || !sentinel.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting))
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [transparentUntilScroll])

  function goBack() {
    if (window.history.length > 1) router.back()
    else router.push(typeof back === 'string' ? back : '/dashboard')
  }

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      <nav aria-label={`${title}: navegação`} className={cn('local-nav', className)} data-scrolled={scrolled}>
        <div className="local-nav-inner">
          {back && (
            <button type="button" onClick={goBack} className="-ml-2.5 flex h-11 min-w-11 flex-none items-center text-[var(--accent)]" aria-label="Voltar">
              <ChevronLeft size={26} strokeWidth={2} aria-hidden />
            </button>
          )}
          <span className={cn('local-nav-title flex-1 transition-opacity duration-300', !scrolled && back ? 'opacity-0' : 'opacity-100')} aria-hidden={!scrolled && Boolean(back)}>
            {title}
          </span>
          {actions && <div className="flex flex-none items-center gap-3">{actions}</div>}
        </div>
      </nav>
    </>
  )
}

interface HeroProps {
  eyebrow?: string
  title: React.ReactNode
  lede?: React.ReactNode
  /** Eyebrow in orange ("Novo") instead of gray. */
  highlight?: boolean
  size?: 'display' | 'large'
  className?: string
  children?: React.ReactNode
}

/** Big editorial headline block that opens each screen. */
export function Hero({ eyebrow, title, lede, highlight, size = 'display', className, children }: HeroProps) {
  return (
    <header className={cn('hero', className)}>
      {eyebrow && <p className={highlight ? 'eyebrow' : 'eyebrow-muted'}>{eyebrow}</p>}
      <h1 className={size === 'display' ? 'display' : 'large-title'}>{title}</h1>
      {lede && <p className="lede">{lede}</p>}
      {children}
    </header>
  )
}

/** Section headline with optional "Ver tudo >" style link. */
export function SectionHeader({ title, action, href, id, className, subtitle }: {
  title: string
  action?: React.ReactNode
  href?: string
  id?: string
  className?: string
  subtitle?: string
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-3 px-1', className)}>
      <div className="min-w-0">
        <h2 id={id} className="section-title">{title}</h2>
        {subtitle && <p className="subhead mt-1 text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action ?? (href && (
        <Link href={href} className="link -mb-2.5 flex-none text-[17px]">Ver tudo<ChevronRight size={17} aria-hidden /></Link>
      ))}
    </div>
  )
}

/** Back-compat wrapper: large-title header used by older screens. */
export function PageHeader({ title, eyebrow, trailing, className }: { title: string; eyebrow?: string; trailing?: React.ReactNode; className?: string }) {
  return (
    <header className={cn('flex items-end justify-between gap-4 pt-6', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow-muted">{eyebrow}</p>}
        <h1 className="large-title truncate">{title}</h1>
      </div>
      {trailing && <div className="flex flex-none items-center gap-2 pb-1">{trailing}</div>}
    </header>
  )
}
