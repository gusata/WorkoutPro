'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Weight, Plus, Trash2, Download, Upload, Edit3, Check, Shield } from 'lucide-react'
import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useProfileStore } from '@/stores/useProfileStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Progress } from '@/components/ui/Progress'
import { getLevelFromXp, levelTitle } from '@/lib/gamification'
import { exportData, importData } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { BodyMeasurement } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const GREEN  = '#00c896'
const INDIGO = '#6366f1'
const AMBER  = '#f59e0b'

const MEASUREMENT_FIELDS: Array<{ key: keyof BodyMeasurement; label: string; unit: string }> = [
  { key: 'weight',   label: 'Peso',        unit: 'kg' },
  { key: 'bodyFat',  label: 'BF%',         unit: '%'  },
  { key: 'chest',    label: 'Peitoral',    unit: 'cm' },
  { key: 'arm',      label: 'Braço',       unit: 'cm' },
  { key: 'forearm',  label: 'Antebraço',   unit: 'cm' },
  { key: 'waist',    label: 'Cintura',     unit: 'cm' },
  { key: 'hip',      label: 'Quadril',     unit: 'cm' },
  { key: 'thigh',    label: 'Coxa',        unit: 'cm' },
  { key: 'calf',     label: 'Panturrilha', unit: 'cm' },
]

export default function ProfilePage() {
  const { profile, measurements, updateProfile, addMeasurement, deleteMeasurement, load } = useProfileStore()
  const [showMeasModal, setShowMeasModal] = useState(false)
  const [editName, setEditName]   = useState(false)
  const [nameInput, setNameInput] = useState(profile?.name ?? '')
  const [measForm, setMeasForm]   = useState<Record<string, string>>({})

  const levelInfo = profile
    ? getLevelFromXp(profile.xp)
    : { level: 1, currentXp: 0, xpNeeded: 100 }

  const weightHistory = measurements
    .filter((m) => m.weight != null)
    .slice(0, 12)
    .reverse()
    .map((m) => ({
      date: format(new Date(m.date), 'dd/MM', { locale: ptBR }),
      weight: m.weight as number,
    }))

  async function saveName() {
    if (nameInput.trim()) {
      await updateProfile({ name: nameInput.trim() })
      setEditName(false)
    }
  }

  async function saveMeasurement() {
    const data: Partial<BodyMeasurement> = { date: new Date(), id: '' }
    MEASUREMENT_FIELDS.forEach(({ key }) => {
      const val = parseFloat(measForm[key] ?? '')
      ;(data as Record<string, number | Date | string | null>)[key as string] =
        !isNaN(val) && val > 0 ? val : null
    })
    await addMeasurement(data as Omit<BodyMeasurement, 'id'>)
    setMeasForm({})
    setShowMeasModal(false)
  }

  async function handleExport() {
    const data = await exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `workoutpro-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text()
      await importData(JSON.parse(text))
      await load()
      alert('Dados importados com sucesso!')
    } catch {
      alert('Erro ao importar. Verifique o arquivo.')
    }
  }

  if (!profile) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: `${GREEN} transparent transparent transparent` }}
      />
    </div>
  )

  return (
    <div className="px-4 pt-14 pb-4 page-content max-w-lg mx-auto space-y-5">
      <div>
        <p className="text-xs text-zinc-500">Seu</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">Perfil</h1>
      </div>

      {/* Identity card — glass */}
      <Card glass glow={INDIGO} className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-none"
            style={{ background: `linear-gradient(135deg, ${INDIGO}cc, #7c3aed)` }}
          >
            <User size={26} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {editName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="flex-1 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${INDIGO}60`,
                  }}
                />
                <button onClick={saveName} style={{ color: GREEN }}>
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-white">{profile.name}</p>
                <button
                  onClick={() => { setNameInput(profile.name); setEditName(true) }}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <Edit3 size={13} />
                </button>
              </div>
            )}
            <p className="text-sm font-semibold mt-0.5" style={{ color: INDIGO }}>
              {levelTitle(levelInfo.level)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-zinc-500 mb-2">
            <span>Nível {levelInfo.level}</span>
            <span>{levelInfo.currentXp.toLocaleString()} / {levelInfo.xpNeeded.toLocaleString()} XP</span>
          </div>
          <Progress value={levelInfo.currentXp} max={levelInfo.xpNeeded} color={INDIGO} />
        </div>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Treinos',       value: `${profile.totalWorkouts}`,         color: INDIGO },
          { label: 'XP Total',      value: profile.xp.toLocaleString(),        color: GREEN  },
          { label: 'Streak',        value: `${profile.streak} dias`,           color: AMBER  },
          { label: 'Maior Streak',  value: `${profile.longestStreak} dias`,    color: AMBER  },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-xl font-bold text-white tracking-tight">{item.value}</p>
            <p className="text-[11px] mt-1 font-medium" style={{ color: item.color }}>{item.label}</p>
          </Card>
        ))}
      </div>

      {/* Body measurements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Medidas Corporais</h2>
          <Button size="sm" variant="secondary" onClick={() => setShowMeasModal(true)}>
            <Plus size={13} />
            Registrar
          </Button>
        </div>

        {weightHistory.length >= 2 && (
          <Card className="p-4 mb-3">
            <p className="text-[11px] text-zinc-500 mb-3 font-medium">Evolução do peso (kg)</p>
            <ResponsiveContainer width="100%" height={90}>
              <LineChart data={weightHistory}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#52525b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#17171b',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke={GREEN}
                  strokeWidth={2}
                  dot={{ fill: GREEN, r: 3, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {measurements.length === 0 ? (
          <div className="text-center py-10 text-zinc-600">
            <Weight size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma medida registrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {measurements.slice(0, 5).map((m) => (
              <Card key={m.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{formatDate(new Date(m.date))}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    {MEASUREMENT_FIELDS.filter(({ key }) => m[key] != null).map(({ key, label, unit }) => (
                      <span key={key} className="text-[11px] text-zinc-500">
                        {label}:{' '}
                        <span className="text-zinc-300 font-medium">
                          {String(m[key])} {unit}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => deleteMeasurement(m.id)}
                  className="p-1.5 text-zinc-700 hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Backup */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={14} className="text-zinc-500" />
          <h2 className="text-sm font-semibold text-white">Backup de dados</h2>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleExport}>
            <Download size={15} />
            Exportar
          </Button>
          <label className="flex-1">
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
            />
            <Button variant="outline" className="w-full" onClick={() => {}}>
              <Upload size={15} />
              Importar
            </Button>
          </label>
        </div>
        <p className="text-[11px] text-zinc-700 mt-3 text-center">
          Todos os dados ficam no seu dispositivo, sem nenhum servidor.
        </p>
      </Card>

      {/* Measurement modal */}
      <Modal open={showMeasModal} onClose={() => setShowMeasModal(false)} title="Registrar Medidas">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {MEASUREMENT_FIELDS.map(({ key, label, unit }) => (
              <Input
                key={key}
                label={`${label} (${unit})`}
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="0"
                value={measForm[key] ?? ''}
                onChange={(e) => setMeasForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setShowMeasModal(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={saveMeasurement}>
            Salvar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
