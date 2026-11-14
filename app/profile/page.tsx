'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, FileDown, FileLock2, FileSpreadsheet, FileUp, Images, Pencil, Plus, Settings, Trash2, Trophy, Upload } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LocalNav, SectionHeader } from '@/components/layout/PageHeader'
import { SupabaseAccountCard } from '@/components/auth/SupabaseAccountCard'
import { WeightTrendTile } from '@/components/insights/WeightTrendTile'
import { useMediaUrl } from '@/components/training/MediaViewer'
import { getLevelFromXp, levelTitle } from '@/lib/gamification'
import { exportData, importData, parseBackup, type ParsedBackup } from '@/lib/backup'
import { formatDate, formatDecimal, parseDecimal } from '@/lib/utils'
import { exportSessionsCsv, importTrainingCsv } from '@/lib/csvInterop'
import { listMedia } from '@/lib/media'
import type { BodyMeasurement, MediaItem } from '@/types'
import { format } from 'date-fns'
import { ACHIEVEMENTS } from '@/lib/achievements'

const MEASUREMENT_FIELDS: Array<{ key: keyof BodyMeasurement; label: string; unit: string }> = [
  { key: 'weight',   label: 'Peso',        unit: 'kg' },
  { key: 'bodyFat',  label: 'BF%',         unit: '%'  },
  { key: 'leanMass', label: 'Massa magra', unit: 'kg' },
  { key: 'chest',    label: 'Peitoral',    unit: 'cm' },
  { key: 'arm',      label: 'Braço',       unit: 'cm' },
  { key: 'forearm',  label: 'Antebraço',   unit: 'cm' },
  { key: 'waist',    label: 'Cintura',     unit: 'cm' },
  { key: 'hip',      label: 'Quadril',     unit: 'cm' },
  { key: 'thigh',    label: 'Coxa',        unit: 'cm' },
  { key: 'calf',     label: 'Panturrilha', unit: 'cm' },
]

/** Settings-style row: icon chip, label, optional detail, chevron. */
function LinkRow({ icon, label, detail, onClick, href }: { icon: React.ReactNode; label: string; detail?: string; onClick?: () => void; href?: string }) {
  const content = (
    <>
      <span aria-hidden className="icon-chip">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {detail && <span className="footnote block text-[var(--muted)]">{detail}</span>}
      </span>
      <ChevronRight size={18} className="flex-none text-[var(--muted)] opacity-70" aria-hidden />
    </>
  )
  const className = 'grouped-row sep-inset-72 flex min-h-14 w-full items-center gap-4 px-5 py-2.5 text-left'
  if (href) return <Link href={href} className={className}>{content}</Link>
  return <button type="button" onClick={onClick} className={className}>{content}</button>
}

export default function ProfilePage() {
  const profile = useProfileStore((state) => state.profile)
  const measurements = useProfileStore((state) => state.measurements)
  const achievements = useProfileStore((state) => state.achievements)
  const updateProfile = useProfileStore((state) => state.updateProfile)
  const addMeasurement = useProfileStore((state) => state.addMeasurement)
  const deleteMeasurement = useProfileStore((state) => state.deleteMeasurement)
  const load = useProfileStore((state) => state.load)
  const loadWorkouts = useWorkoutStore((state) => state.load)
  const workouts = useWorkoutStore((state) => state.workouts)
  const exercises = useWorkoutStore((state) => state.exercises)
  const [deleteTarget, setDeleteTarget] = useState<BodyMeasurement | null>(null)
  const [showMeasModal, setShowMeasModal] = useState(false)
  const [editName, setEditName] = useState(false)
  const [nameInput, setNameInput] = useState(profile?.name ?? '')
  const [measForm, setMeasForm] = useState<Record<string, string>>({})
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pendingImport, setPendingImport] = useState<ParsedBackup | null>(null)
  const [importing, setImporting] = useState(false)
  const [photos, setPhotos] = useState<MediaItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void listMedia('photo').then(setPhotos).catch(() => setPhotos([]))
  }, [])

  const levelInfo = profile ? getLevelFromXp(profile.xp) : { level: 1, currentXp: 0, xpNeeded: 100 }

  const weightPoints = useMemo(() => measurements
    .filter((m) => m.weight != null)
    .reverse()
    .map((m) => ({ date: new Date(m.date), value: m.weight as number })), [measurements])

  async function saveName() {
    if (nameInput.trim()) {
      await updateProfile({ name: nameInput.trim() })
      setEditName(false)
    }
  }

  async function saveMeasurement() {
    const data: Partial<BodyMeasurement> = { date: new Date(), id: '' }
    MEASUREMENT_FIELDS.forEach(({ key }) => {
      const val = parseDecimal(measForm[key] ?? '')
      ;(data as Record<string, number | Date | string | null>)[key as string] = val != null && val > 0 ? val : null
    })
    await addMeasurement(data as Omit<BodyMeasurement, 'id' | 'updatedAt'>)
    setMeasForm({})
    setShowMeasModal(false)
  }

  async function handleExport() {
    const data = await exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workoutpro-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File) {
    try {
      setImportStatus(null)
      setPendingImport(null)
      setPendingImport(parseBackup(JSON.parse(await file.text())))
    } catch {
      setImportStatus({ type: 'error', message: 'Nao foi possivel importar. Verifique o arquivo.' })
    }
  }

  function downloadCsv() {
    const blob = new Blob([exportSessionsCsv(useProfileStore.getState().sessions, workouts, exercises)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `workoutpro-historico-${format(new Date(), 'yyyy-MM-dd')}.csv`; anchor.click(); URL.revokeObjectURL(url)
  }

  async function handleCsv(file: File) {
    try {
      const result = await importTrainingCsv(await file.text())
      await Promise.all([load(), loadWorkouts()])
      setImportStatus({ type: 'success', message: `${result.sessions} sessões e ${result.sets} séries importadas do CSV.` })
    } catch {
      setImportStatus({ type: 'error', message: 'CSV não reconhecido. Use uma exportação do Strong ou Hevy.' })
    }
  }

  async function confirmImport() {
    if (!pendingImport || importing) return
    setImporting(true)
    try {
      await importData(pendingImport)
      useSessionStore.getState().discardSession()
      await Promise.all([load(), loadWorkouts()])
      setPendingImport(null)
      setImportStatus({ type: 'success', message: 'Backup validado e importado com sucesso.' })
    } catch {
      setImportStatus({ type: 'error', message: 'A importacao falhou sem substituir seus dados atuais.' })
    } finally {
      setImporting(false)
    }
  }

  if (!profile) return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--muted)] border-t-transparent" />
      <span className="sr-only">Carregando perfil</span>
    </div>
  )

  const initials = (profile.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('') || 'A').toUpperCase()
  const latestWeight = weightPoints.at(-1)

  return (
    <div className="apple-page page-content">
      <LocalNav title="Você" actions={<Link href="/settings" className="pill pill-secondary" aria-label="Ajustes"><Settings size={14} aria-hidden />Ajustes</Link>} />

      {/* Identity */}
      <header className="hero flex flex-col items-center text-center">
        <span aria-hidden className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--foreground)] text-[36px] font-semibold tracking-[-0.02em] text-[var(--background-elevated)]">
          {initials}
        </span>
        <h1 className="sr-only">Perfil</h1>
        {editName ? (
          <div className="mt-5 flex w-full max-w-xs items-center gap-2">
            <input
              autoFocus
              aria-label="Seu nome"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveName()
                if (e.key === 'Escape') setEditName(false)
              }}
              className="field min-w-0 flex-1 text-center"
            />
            <Button size="sm" onClick={saveName} className="h-11">OK</Button>
          </div>
        ) : (
          <button type="button" onClick={() => { setNameInput(profile.name); setEditName(true) }} className="mt-5 flex min-h-11 items-center gap-2 rounded-full px-3" aria-label={`Editar nome: ${profile.name}`}>
            <span className="display">{profile.name}</span>
            <Pencil size={16} className="text-[var(--muted)]" aria-hidden />
          </button>
        )}
        <p className="eyebrow mt-1">{levelTitle(levelInfo.level)} · Nível {levelInfo.level}</p>
        <div className="mt-5 w-full max-w-xs">
          <div className="progress-track" role="progressbar" aria-label={`Progresso para o nível ${levelInfo.level + 1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((levelInfo.currentXp / levelInfo.xpNeeded) * 100)}>
            <div className="progress-fill" style={{ width: `${(levelInfo.currentXp / levelInfo.xpNeeded) * 100}%` }} />
          </div>
          <p className="footnote numeric mt-2 text-[var(--muted)]">{levelInfo.currentXp.toLocaleString('pt-BR')} de {levelInfo.xpNeeded.toLocaleString('pt-BR')} XP para o nível {levelInfo.level + 1}</p>
        </div>
      </header>

      <section className="tile mt-10 grid grid-cols-3 gap-2 !px-5 text-center" aria-label="Seus números">
        {[
          { label: 'Treinos', value: `${profile.totalWorkouts}`, testId: 'profile-total-workouts' },
          { label: 'Sequência', value: `${profile.streak}`, unit: profile.streak === 1 ? 'dia' : 'dias' },
          { label: 'Recorde', value: `${profile.longestStreak}`, unit: profile.longestStreak === 1 ? 'dia' : 'dias' },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <p data-testid={item.testId} className="stat text-[32px]">{item.value}</p>
            <p className="footnote mt-1 text-[var(--muted)]">{item.unit ? `${item.label} · ${item.unit}` : item.label}</p>
          </div>
        ))}
      </section>

      {/* Body */}
      <section aria-labelledby="measurements-title" className="stack-section">
        <SectionHeader id="measurements-title" title="Corpo." action={<Button size="sm" variant="tinted" onClick={() => setShowMeasModal(true)} className="-mb-1"><Plus size={16} aria-hidden />Registrar</Button>} />
        {latestWeight && <WeightTrendTile points={weightPoints} className="tile mb-3" />}

        <PhotosTile photos={photos} />

        {measurements.length === 0 ? (
          <div className="tile mt-3 text-center">
            <p className="headline">Nenhuma medida ainda</p>
            <p className="footnote mt-1 text-[var(--muted)]">Registre peso e circunferências para ver sua evolução.</p>
          </div>
        ) : (
          <ul className="list mt-3">
            {measurements.slice(0, 5).map((m) => (
              <li key={m.id} className="grouped-row flex items-center gap-3 py-3 pl-5 pr-2">
                <div className="min-w-0 flex-1">
                  <p>{formatDate(new Date(m.date))}</p>
                  <p className="footnote numeric mt-0.5 text-[var(--muted)]">
                    {MEASUREMENT_FIELDS.filter(({ key }) => m[key] != null).map(({ key, label, unit }) => `${label} ${formatDecimal(m[key] as number)} ${unit}`).join(' · ')}
                  </p>
                </div>
                <button type="button" onClick={() => setDeleteTarget(m)} aria-label={`Excluir medida de ${formatDate(new Date(m.date))}`} className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[var(--muted)]">
                  <Trash2 size={17} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="more-title" className="stack-section">
        <h2 id="more-title" className="list-header">Mais</h2>
        <div className="list">
          <LinkRow icon={<Trophy size={17} aria-hidden />} label="Prêmios" detail={`${achievements.length} de ${ACHIEVEMENTS.length} conquistados`} href="/achievements" />
          <LinkRow icon={<Settings size={17} aria-hidden />} label="Ajustes" detail="Metas, lembretes, saúde e aparência" href="/settings" />
        </div>
      </section>

      <section aria-labelledby="account-title" className="stack-section">
        <h2 id="account-title" className="list-header">Conta</h2>
        <SupabaseAccountCard />
      </section>

      <section aria-labelledby="data-title" className="stack-section">
        <h2 id="data-title" className="list-header">Seus dados</h2>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void handleImport(file) }} />
        <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void handleCsv(file) }} />
        <div className="list">
          <LinkRow icon={<FileDown size={17} aria-hidden />} label="Exportar backup" detail="Arquivo .json com tudo" onClick={handleExport} />
          <LinkRow icon={<FileUp size={17} aria-hidden />} label="Importar backup" onClick={() => fileInputRef.current?.click()} />
          <LinkRow icon={<FileSpreadsheet size={17} aria-hidden />} label="Exportar histórico CSV" onClick={downloadCsv} />
          <LinkRow icon={<Upload size={17} aria-hidden />} label="Importar do Strong / Hevy" detail="Arquivo .csv" onClick={() => csvInputRef.current?.click()} />
          <LinkRow icon={<FileLock2 size={17} aria-hidden />} label="Privacidade e diagnóstico" href="/privacy" />
        </div>
        {importStatus ? (
          <p role={importStatus.type === 'error' ? 'alert' : 'status'} className={`list-footer ${importStatus.type === 'error' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
            {importStatus.message}
          </p>
        ) : (
          <p className="list-footer">Os dados ficam primeiro neste aparelho. Fotos e vídeos não entram no backup.</p>
        )}
      </section>

      <Modal open={showMeasModal} onClose={() => setShowMeasModal(false)} title="Registrar medidas">
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {MEASUREMENT_FIELDS.map(({ key, label, unit }) => (
              <Input
                key={key}
                label={`${label} (${unit})`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="—"
                value={measForm[key] ?? ''}
                onChange={(e) => {
                  const text = e.target.value
                  if (/^\d*([.,]\d{0,2})?$/.test(text)) setMeasForm((f) => ({ ...f, [key]: text }))
                }}
              />
            ))}
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setShowMeasModal(false)}>Cancelar</Button>
          <Button className="flex-1" onClick={saveMeasurement}>Salvar</Button>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir medida">
        <p className="subhead mb-6 text-[var(--muted)]">Excluir o registro de {deleteTarget ? formatDate(new Date(deleteTarget.date)) : ''}? Essa ação não pode ser desfeita.</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={async () => { if (deleteTarget) await deleteMeasurement(deleteTarget.id); setDeleteTarget(null) }}><Trash2 size={15} aria-hidden />Excluir</Button>
        </div>
      </Modal>

      <Modal open={!!pendingImport} onClose={() => setPendingImport(null)} title="Confirmar importacao">
        {pendingImport && (
          <div className="space-y-4">
            <p className="subhead text-[var(--muted)]">
              O arquivo foi validado. Confirmar substituirá os dados locais e preparará todo o conteúdo para sincronização.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([['workouts', 'treinos'], ['exercises', 'exercícios'], ['sessions', 'sessões'], ['measurements', 'medidas']] as const).map(([key, label]) => (
                <div key={key} className="rounded-[var(--radius-sm)] bg-[var(--fill)] p-3.5">
                  <strong className="stat text-[22px]">{pendingImport.preview[key]}</strong>
                  <span className="footnote ml-1.5 text-[var(--muted)]">{label}</span>
                </div>
              ))}
            </div>
            <p className="footnote text-[var(--muted)]">Perfil: {pendingImport.preview.profileName}</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" disabled={importing} onClick={() => setPendingImport(null)}>Cancelar</Button>
              <Button className="flex-1" disabled={importing} onClick={confirmImport}>{importing ? 'Importando...' : 'Importar'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function PhotosTile({ photos }: { photos: MediaItem[] }) {
  const first = photos.at(-1)
  const latest = photos[0]
  const { url: firstUrl } = useMediaUrl(photos.length > 1 ? first?.id : null)
  const { url: latestUrl } = useMediaUrl(latest?.id)
  return (
    <Link href="/photos" className="tile tile-link flex items-center gap-4 !py-5 !pl-5" aria-label={`Fotos de progresso: ${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`}>
      <span aria-hidden className="flex flex-none -space-x-4">
        {latestUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
            {firstUrl && <img src={firstUrl} alt="" className="h-16 w-12 rounded-[10px] object-cover ring-2 ring-[var(--surface)]" />}
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
            <img src={latestUrl} alt="" className="h-16 w-12 rounded-[10px] object-cover ring-2 ring-[var(--surface)]" />
          </>
        ) : (
          <span className="icon-chip h-14 w-14 rounded-[14px]"><Images size={22} /></span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="headline block">Fotos de progresso</span>
        <span className="footnote block text-[var(--muted)]">{photos.length === 0 ? 'Compare antes e depois, lado a lado.' : `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'} · toque para comparar`}</span>
      </span>
      <ChevronRight size={18} className="flex-none text-[var(--muted)]" aria-hidden />
    </Link>
  )
}
