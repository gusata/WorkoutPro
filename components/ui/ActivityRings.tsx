'use client'

export interface RingData {
  /** 0..n — values above 1 draw a second lap, like Apple's rings. */
  progress: number
  color: string
  label: string
}

interface ActivityRingsProps {
  rings: RingData[]
  size?: number
  stroke?: number
  gap?: number
  /** Accessible summary; rings themselves are decorative. */
  label: string
}

/** Concentric progress rings in the style of Apple Fitness. */
export function ActivityRings({ rings, size = 132, stroke = 16, gap = 3, label }: ActivityRingsProps) {
  const center = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90 flex-none">
      {rings.map((ring, index) => {
        const radius = center - stroke / 2 - index * (stroke + gap)
        if (radius <= stroke / 2) return null
        const circumference = 2 * Math.PI * radius
        const clamped = Math.max(0, Math.min(ring.progress, 1))
        const offset = circumference * (1 - clamped)
        return (
          <g key={ring.label}>
            <circle cx={center} cy={center} r={radius} fill="none" stroke={ring.color} strokeOpacity={0.2} strokeWidth={stroke} />
            {clamped > 0 && (
              <circle
                className="ring-animate"
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ ['--ring-circumference' as string]: `${circumference}`, transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)' }}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Single small ring used in week strips. */
export function MiniRing({ progress, color, size = 34, stroke = 4.5, children }: { progress: number; color: string; size?: number; stroke?: number; children?: React.ReactNode }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(progress, 1))
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={stroke} />
        {clamped > 0 && (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped)} />
        )}
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  )
}
