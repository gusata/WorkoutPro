import type { MuscleGroup } from '@/types'
import { MUSCLE_GROUPS } from '@/lib/utils'

export interface WorkoutTemplateExercise {
  name: string
  muscleGroup: MuscleGroup
  notes: string
}

export interface WorkoutTemplate {
  id: string
  name: string
  description: string
  frequency: string
  color: string
  exercises: WorkoutTemplateExercise[]
}

const noteBase = 'Registre carga, reps e ajuste usado. Priorize amplitude controlada e deixe 1-3 reps em reserva na maioria das series.'

const MG = {
  chest: MUSCLE_GROUPS[0],
  back: MUSCLE_GROUPS[1],
  shoulders: MUSCLE_GROUPS[2],
  biceps: MUSCLE_GROUPS[3],
  triceps: MUSCLE_GROUPS[4],
  abs: MUSCLE_GROUPS[6],
  quads: MUSCLE_GROUPS[7],
  hamstrings: MUSCLE_GROUPS[8],
  calves: MUSCLE_GROUPS[10],
} satisfies Record<string, MuscleGroup>

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'full_body_a',
    name: 'Full Body A',
    description: 'Rotina equilibrada para 2-3 dias por semana, cobrindo grandes grupos musculares em uma sessao.',
    frequency: '2-3x/semana',
    color: '#e65f43',
    exercises: [
      { name: 'Agachamento', muscleGroup: MG.quads, notes: `${noteBase} Anote profundidade, base dos pes e se usou cinto.` },
      { name: 'Supino Reto', muscleGroup: MG.chest, notes: `${noteBase} Anote pino do banco, largura da pegada e pausa no peito.` },
      { name: 'Remada Curvada', muscleGroup: MG.back, notes: `${noteBase} Anote angulo do tronco e controle da lombar.` },
      { name: 'Desenvolvimento', muscleGroup: MG.shoulders, notes: `${noteBase} Anote se fez sentado/em pe e evite compensar com lombar.` },
      { name: 'Prancha', muscleGroup: MG.abs, notes: 'Registre tempo, postura e dificuldade. Pare se perder alinhamento.' },
    ],
  },
  {
    id: 'upper',
    name: 'Upper',
    description: 'Parte superior para alternar com Lower quando voce treina 4 dias por semana.',
    frequency: '2x/semana no upper/lower',
    color: '#6366f1',
    exercises: [
      { name: 'Supino Reto', muscleGroup: MG.chest, notes: `${noteBase} Principal empurrada horizontal. Anote pegada e setup.` },
      { name: 'Puxada Frontal', muscleGroup: MG.back, notes: `${noteBase} Anote pegada, amplitude e se encostou no peito.` },
      { name: 'Desenvolvimento', muscleGroup: MG.shoulders, notes: `${noteBase} Principal empurrada vertical. Mantenha tronco estavel.` },
      { name: 'Remada Baixa', muscleGroup: MG.back, notes: `${noteBase} Anote triangulo/barra usada e controle da escapula.` },
      { name: 'Triceps Pulley', muscleGroup: MG.triceps, notes: 'Isolador. Controle a volta, mantenha cotovelos fixos e registre o acessorio usado.' },
      { name: 'Rosca Direta', muscleGroup: MG.biceps, notes: 'Isolador. Evite balanco do tronco e registre barra/pegada usada.' },
    ],
  },
  {
    id: 'lower',
    name: 'Lower',
    description: 'Parte inferior para alternar com Upper, cobrindo quadriceps, posterior, gluteo e panturrilha.',
    frequency: '2x/semana no upper/lower',
    color: '#22c55e',
    exercises: [
      { name: 'Agachamento', muscleGroup: MG.quads, notes: `${noteBase} Anote profundidade, base e variacao.` },
      { name: 'Leg Press', muscleGroup: MG.quads, notes: `${noteBase} Anote posicao dos pes e amplitude.` },
      { name: 'Stiff', muscleGroup: MG.hamstrings, notes: `${noteBase} Foque dobrar no quadril e registrar amplitude sem perder coluna neutra.` },
      { name: 'Mesa Flexora', muscleGroup: MG.hamstrings, notes: 'Isolador posterior. Controle a fase de volta e registre ajuste da maquina.' },
      { name: 'Elevacao de Panturrilha', muscleGroup: MG.calves, notes: 'Use pausa no alongamento/contracao e registre maquina usada.' },
    ],
  },
  {
    id: 'push',
    name: 'Push',
    description: 'Peitoral, ombros e triceps. Boa opcao para uma divisao Push/Pull/Legs.',
    frequency: '1-2x/semana',
    color: '#f43f5e',
    exercises: [
      { name: 'Supino Reto', muscleGroup: MG.chest, notes: `${noteBase} Empurrada pesada. Anote setup e pausa.` },
      { name: 'Supino Inclinado', muscleGroup: MG.chest, notes: `${noteBase} Anote inclinacao do banco para repetir o mesmo padrao.` },
      { name: 'Desenvolvimento', muscleGroup: MG.shoulders, notes: `${noteBase} Evite transformar em supino inclinado; registre variacao.` },
      { name: 'Elevacao Lateral', muscleGroup: MG.shoulders, notes: 'Controle a subida sem impulso e registre halter/cabo.' },
      { name: 'Triceps Pulley', muscleGroup: MG.triceps, notes: 'Mantenha cotovelos fixos e registre acessorio usado.' },
    ],
  },
  {
    id: 'pull',
    name: 'Pull',
    description: 'Costas, deltoide posterior, trapezio e biceps para uma divisao Push/Pull/Legs.',
    frequency: '1-2x/semana',
    color: '#06b6d4',
    exercises: [
      { name: 'Puxada Frontal', muscleGroup: MG.back, notes: `${noteBase} Anote pegada e amplitude.` },
      { name: 'Remada Curvada', muscleGroup: MG.back, notes: `${noteBase} Registre angulo do tronco e estabilidade.` },
      { name: 'Remada Baixa', muscleGroup: MG.back, notes: `${noteBase} Registre acessorio e foco na escapula.` },
      { name: 'Face Pull', muscleGroup: MG.shoulders, notes: 'Controle leve/moderado. Registre altura da polia e pegada.' },
      { name: 'Rosca Direta', muscleGroup: MG.biceps, notes: 'Evite impulso e registre barra/pegada.' },
    ],
  },
  {
    id: 'legs',
    name: 'Legs',
    description: 'Pernas completas para a divisao Push/Pull/Legs.',
    frequency: '1-2x/semana',
    color: '#f59e0b',
    exercises: [
      { name: 'Agachamento', muscleGroup: MG.quads, notes: `${noteBase} Movimento principal. Registre profundidade e base.` },
      { name: 'Leg Press', muscleGroup: MG.quads, notes: `${noteBase} Anote posicao dos pes.` },
      { name: 'Stiff', muscleGroup: MG.hamstrings, notes: `${noteBase} Priorize controle de quadril.` },
      { name: 'Cadeira Extensora', muscleGroup: MG.quads, notes: 'Isolador. Registre ajuste da maquina e controle o topo.' },
      { name: 'Elevacao de Panturrilha', muscleGroup: MG.calves, notes: 'Registre pausa e amplitude.' },
    ],
  },
]
