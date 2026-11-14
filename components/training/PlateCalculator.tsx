'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { calculatePlates } from '@/lib/training'
import { formatDecimal } from '@/lib/utils'

/** Competition plate colors so each disc is recognisable at a glance. */
const PLATE_STYLE: Record<string, { color: string; height: number; width: number; text: string }> = {
  '25': { color: '#e5262c', height: 92, width: 15, text: '#fff' },
  '20': { color: '#1f6fe0', height: 92, width: 13, text: '#fff' },
  '15': { color: '#f2c200', height: 84, width: 12, text: '#1d1d1f' },
  '10': { color: '#1f9d48', height: 74, width: 11, text: '#fff' },
  '5': { color: '#f5f5f7', height: 58, width: 9, text: '#1d1d1f' },
  '2.5': { color: '#1d1d1f', height: 46, width: 8, text: '#fff' },
  '1.25': { color: '#a1a1a6', height: 38, width: 7, text: '#1d1d1f' },
}

const BAR_OPTIONS = [
  { value: '20', label: '20 kg' },
  { value: '15', label: '15 kg' },
  { value: '10', label: '10 kg' },
] as const

export function PlateCalculator({ target, defaultBar = 20, onClose }: {
  target: { name: string; weight: number } | null
  defaultBar?: number
  onClose: () => void
}) {
  return (
    <Modal open={!!target} onClose={onClose} title="Anilhas">
      {target && <PlateCalculatorBody key={`${target.name}-${target.weight}`} target={target} defaultBar={defaultBar} />}
    </Modal>
  )
}

function PlateCalculatorBody({ target, defaultBar }: { target: { name: string; weight: number }; defaultBar: number }) {
  const [weight, setWeight] = useState(target.weight)
  const [bar, setBar] = useState(String([20, 15, 10].includes(defaultBar) ? defaultBar : 20))
  const result = calculatePlates(weight, Number(bar))
  const discs = result.perSide.flatMap((item) => Array.from({ length: item.perSide }, () => item.plate))
  const description = result.perSide.length
    ? result.perSide.map((item) => `${item.perSide} de ${formatDecimal(item.plate)} kg`).join(', ')
    : 'Somente a barra'

  return (
    <div>
      <p className="subhead text-[var(--muted)]">{target.name}</p>
      <label className="mt-1 flex items-baseline gap-2">
        <span className="sr-only">Carga total em kg</span>
        <DecimalInput value={weight} onValueChange={setWeight} className="stat w-40 bg-transparent text-[48px] outline-none" />
        <span className="title-3 text-[var(--muted)]">kg</span>
      </label>

      <div className="mt-5">
        <SegmentedControl label="Peso da barra" value={bar} onChange={setBar} options={[...BAR_OPTIONS]} />
      </div>

      {/* One side of the bar, collar at the left */}
      <figure className="mt-7 rounded-[var(--radius-lg)] bg-[var(--fill)] px-4 py-6">
        <div role="img" aria-label={`Em cada lado: ${description}`} className="relative flex h-24 items-center">
          <span aria-hidden className="absolute left-0 right-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-[#a1a1a6]" />
          <span aria-hidden className="relative h-9 w-3 flex-none rounded-[3px] bg-[#6e6e73]" />
          <div aria-hidden className="relative ml-1 flex items-center gap-[3px]">
            {discs.map((plate, index) => {
              const style = PLATE_STYLE[String(plate)] ?? PLATE_STYLE['1.25']
              return (
                <span
                  key={index}
                  className="flex items-center justify-center rounded-[4px] text-[9px] font-bold [writing-mode:vertical-rl]"
                  style={{ height: style.height, width: style.width, background: style.color, color: style.text, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}
                >
                  {style.width >= 11 ? formatDecimal(plate) : ''}
                </span>
              )
            })}
          </div>
        </div>
        <figcaption className="mt-4">
          <p className="caption font-semibold text-[var(--muted)]">Em cada lado</p>
          <p className="title-3 mt-0.5">{description}</p>
          <p className="footnote mt-1 text-[var(--muted)]">
            Carga montada: {formatDecimal(result.actualWeight)} kg
            {result.remainder > 0 ? ` · faltam ${formatDecimal(result.remainder)} kg por lado` : ''}
          </p>
        </figcaption>
      </figure>
    </div>
  )
}
