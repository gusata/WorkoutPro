'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { reportError } from '@/lib/observability'

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportError('app-render', error, { digest: error.digest ?? null })
  }, [error])

  return (
    <div className="apple-page page-content flex min-h-dvh items-center">
      <Card className="w-full rounded-[var(--radius-xl)] px-6 py-12 text-center" role="alert">
        <AlertTriangle size={30} strokeWidth={1.7} className="mx-auto text-[var(--warning)]" aria-hidden />
        <h1 className="display mt-6">Algo saiu do esperado.</h1>
        <p className="lede mx-auto mt-3 max-w-xs">
          Seus dados locais foram preservados. Tente carregar esta tela novamente.
        </p>
        <Button className="mt-6" onClick={retry}>
          <RefreshCw size={16} aria-hidden />
          Tentar novamente
        </Button>
      </Card>
    </div>
  )
}
