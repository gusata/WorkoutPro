import { Cloud, Database, HeartPulse, Images, ShieldCheck, Trash2 } from 'lucide-react'
import { Hero, LocalNav } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { DiagnosticsCard } from '@/components/privacy/DiagnosticsCard'

const sections = [
  { icon: Database, title: 'Dados no aparelho', text: 'Treinos, historico, medidas e perfil ficam primeiro no IndexedDB deste dispositivo e funcionam sem conta.' },
  { icon: Cloud, title: 'Nuvem opcional', text: 'Quando voce conecta uma conta, os dados podem ser sincronizados com o Supabase para backup e uso em outros aparelhos.' },
  { icon: ShieldCheck, title: 'Sem rastreamento pessoal', text: 'O app nao inclui publicidade nem envia diagnosticos automaticamente. O registro tecnico local remove emails, URLs, tokens e segredos.' },
  { icon: HeartPulse, title: 'Dados de saúde', text: 'Com sua permissão, o app lê peso, gordura corporal, frequência cardíaca, HRV, VO2 máx, passos, sono e treinos de cardio do Apple Saúde ou Health Connect, e grava o peso que você registra. Leituras de sono e coração ficam só neste aparelho; treinos de cardio importados podem ir para sua conta. Nada disso é vendido ou usado para publicidade.' },
  { icon: Images, title: 'Fotos e vídeos', text: 'Fotos de progresso e vídeos de execução ficam só neste aparelho. Não entram em backups nem na sincronização.' },
  { icon: Trash2, title: 'Controle e exclusao', text: 'Voce pode exportar um backup ou apagar todos os dados locais em Você. A exclusao na nuvem depende da conta conectada.' },
]

export default function PrivacyPage() {
  return (
    <div className="apple-page page-content space-y-3">
      <LocalNav title="Privacidade" back="/profile" />
      <Hero eyebrow="Transparência" title="Privacidade." lede="Como o WorkoutPro trata seus dados." className="pb-8" />

      {sections.map(({ icon: Icon, title, text }) => (
        <Card key={title} className="rounded-[var(--radius-xl)] p-6">
          <Icon size={24} strokeWidth={1.7} aria-hidden />
          <h2 className="title-3 mt-4 text-[var(--foreground)]">{title}</h2>
          <p className="subhead mt-1.5 text-[var(--muted)]">{text}</p>
        </Card>
      ))}

      <DiagnosticsCard />

      <p className="footnote pt-4 text-center text-[var(--muted)]">Versão desta política: 13 de novembro de 2026.</p>
    </div>
  )
}
