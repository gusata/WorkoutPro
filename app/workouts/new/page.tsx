'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Search, Trash2, Check } from 'lucide-react'
import { useWorkoutStore } from '@/stores/useWorkoutStore'
import { Input, Select, TextArea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { WORKOUT_COLORS, WORKOUT_ICONS, MUSCLE_GROUPS } from '@/lib/utils'
import type { Exercise } from '@/types'

export default function NewWorkoutPage() {
  const router = useRouter()
  const { workouts, exercises, addWorkout, addExercise } = useWorkoutStore()

  const [name, setName] = useState('')
  const [color, setColor] = useState(WORKOUT_COLORS[0])
  const [selectedExercises, setSelectedExercises] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // New exercise modal
  const [showExModal, setShowExModal] = useState(false)
  const [exName, setExName] = useState('')
  const [exMuscle, setExMuscle] = useState(MUSCLE_GROUPS[0])
  const [exNotes, setExNotes] = useState('')
  const [exSearch, setExSearch] = useState('')

  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(exSearch.toLowerCase())
  )

  function toggleExercise(id: string) {
    setSelectedExercises((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function createExercise() {
    if (!exName.trim()) return
    await addExercise({ name: exName.trim(), muscleGroup: exMuscle, notes: exNotes })
    setExName('')
    setExNotes('')
    setShowExModal(false)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const id = await addWorkout({
      name: name.trim(),
      color,
      icon: 'Dumbbell',
      exerciseIds: selectedExercises,
    })
    router.push(`/workouts/detail?id=${id}`)
  }

  return (
    <div className="px-4 pt-14 pb-4 page-content max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="rounded-xl p-2 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white">Novo Treino</h1>
      </div>

      <div className="space-y-5">
        {/* Name */}
        <Input
          label="Nome do treino"
          placeholder="Ex: Push, Pull, Legs..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Color */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Cor</p>
          <div className="flex gap-2 flex-wrap">
            {WORKOUT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full transition-transform active:scale-90"
                style={{
                  background: c,
                  transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <motion.div
          animate={{ borderColor: color }}
          className="rounded-2xl p-4 flex items-center gap-3 border"
          style={{ background: `${color}08`, borderColor: `${color}30` }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}25` }}>
            <span style={{ color }} className="text-lg">💪</span>
          </div>
          <div>
            <p className="font-bold text-white">{name || 'Nome do treino'}</p>
            <p className="text-xs text-zinc-500">{selectedExercises.length} exercício(s)</p>
          </div>
        </motion.div>

        {/* Exercises */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Exercícios</p>
            <button
              onClick={() => setShowExModal(true)}
              className="text-xs text-indigo-400 flex items-center gap-1 hover:text-indigo-300 transition-colors"
            >
              <Plus size={14} />
              Criar novo
            </button>
          </div>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={exSearch}
              onChange={(e) => setExSearch(e.target.value)}
              placeholder="Buscar exercício..."
              className="w-full h-10 rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-sm text-zinc-600 text-center py-4">
                {exercises.length === 0 ? 'Crie seu primeiro exercício' : 'Nenhum exercício encontrado'}
              </p>
            )}
            {filtered.map((e) => {
              const selected = selectedExercises.includes(e.id)
              return (
                <motion.button
                  key={e.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleExercise(e.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left"
                  style={{
                    background: selected ? `${color}15` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected ? color + '30' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-none border transition-all"
                    style={{
                      background: selected ? color : 'transparent',
                      borderColor: selected ? color : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    {selected && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{e.name}</p>
                    <p className="text-xs text-zinc-500">{e.muscleGroup}</p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={handleSave}
          disabled={!name.trim() || saving}
        >
          {saving ? 'Salvando...' : 'Criar Treino'}
        </Button>
      </div>

      {/* New Exercise Modal */}
      <Modal open={showExModal} onClose={() => setShowExModal(false)} title="Novo Exercício">
        <div className="space-y-4">
          <Input
            label="Nome"
            placeholder="Ex: Supino Reto"
            value={exName}
            onChange={(e) => setExName(e.target.value)}
          />
          <Select
            label="Grupo muscular"
            value={exMuscle}
            onChange={(e) => setExMuscle(e.target.value as typeof exMuscle)}
            options={MUSCLE_GROUPS.map((g) => ({ value: g, label: g }))}
          />
          <TextArea
            label="Observações (opcional)"
            placeholder="Dicas de execução..."
            value={exNotes}
            onChange={(e) => setExNotes(e.target.value)}
            rows={2}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowExModal(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={createExercise} disabled={!exName.trim()}>
              Criar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
