import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(resolve('supabase/schema.sql'), 'utf8').toLowerCase()
const protectedTables = ['profiles', 'workouts', 'exercises', 'workout_sessions', 'body_measurements', 'achievements', 'cardio_sessions']

describe('seguranca do schema Supabase', () => {
  it.each(protectedTables)('habilita RLS e define politica para %s', (table) => {
    expect(schema).toContain(`alter table public.${table} enable row level security`)
    expect(schema).toMatch(new RegExp(`create policy [\\s\\S]{0,160} on public\\.${table}`))
  })

  it('restringe entidades ao usuario autenticado', () => {
    expect(schema.match(/auth\.uid\(\) = user_id/g)?.length).toBeGreaterThanOrEqual(10)
    expect(schema.match(/auth\.uid\(\) = id/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
