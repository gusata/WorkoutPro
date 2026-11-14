import Link from 'next/link'
import { ArrowLeft, Dumbbell } from 'lucide-react'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'

export default function NotFound() {
  return (
    <div className="apple-page page-content flex min-h-dvh items-center">
      <Card className="w-full rounded-[var(--radius-xl)] px-6 py-12 text-center">
        <Dumbbell size={30} strokeWidth={1.7} className="mx-auto" aria-hidden />
        <p className="eyebrow mt-6">Página não encontrada</p>
        <h1 className="display mt-1">Esse caminho não existe.</h1>
        <p className="lede mx-auto mt-3 max-w-xs">
          Volte para o início e continue de onde parou.
        </p>
        <Link href="/dashboard" className={buttonClasses({ className: 'mt-6' })}>
          <ArrowLeft size={16} aria-hidden />
          Voltar ao início
        </Link>
      </Card>
    </div>
  )
}
