import Link from 'next/link'
import { ArrowLeft, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function NotFound() {
  return (
    <div className="apple-page page-content flex min-h-dvh items-center pb-28">
      <Card glass className="w-full p-6 text-center">
        <div className="soft-icon mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem]">
          <Dumbbell size={26} />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Pagina nao encontrada</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)]">Esse caminho nao existe</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[var(--muted)]">
          Volte para o dashboard e continue de onde parou.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex">
          <Button>
            <ArrowLeft size={16} />
            Voltar ao dashboard
          </Button>
        </Link>
      </Card>
    </div>
  )
}
