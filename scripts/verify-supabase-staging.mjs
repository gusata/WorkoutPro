import { createClient } from '@supabase/supabase-js'

const required = [
  'SUPABASE_STAGING_URL', 'SUPABASE_STAGING_ANON_KEY',
  'SUPABASE_STAGING_USER_A_EMAIL', 'SUPABASE_STAGING_USER_A_PASSWORD',
  'SUPABASE_STAGING_USER_B_EMAIL', 'SUPABASE_STAGING_USER_B_PASSWORD',
]

const missing = required.filter((name) => !process.env[name])
if (missing.length > 0) {
  console.error(`Variaveis ausentes: ${missing.join(', ')}`)
  process.exit(2)
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const clientA = createClient(process.env.SUPABASE_STAGING_URL, process.env.SUPABASE_STAGING_ANON_KEY, options)
const clientB = createClient(process.env.SUPABASE_STAGING_URL, process.env.SUPABASE_STAGING_ANON_KEY, options)

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw error ?? new Error(`Login sem usuario para ${email}`)
  return data.user
}

const userA = await signIn(clientA, process.env.SUPABASE_STAGING_USER_A_EMAIL, process.env.SUPABASE_STAGING_USER_A_PASSWORD)
const userB = await signIn(clientB, process.env.SUPABASE_STAGING_USER_B_EMAIL, process.env.SUPABASE_STAGING_USER_B_PASSWORD)
if (userA.id === userB.id) throw new Error('Os usuarios de staging precisam ser contas diferentes')

const testId = `rls-check-${Date.now()}`
const now = new Date().toISOString()

try {
  const { error: createError } = await clientA.from('workouts').insert({
    id: testId,
    user_id: userA.id,
    name: 'RLS isolation check',
    color: '#6366f1',
    icon: 'Dumbbell',
    exercise_ids: [],
    created_at: now,
    updated_at: now,
  })
  if (createError) throw createError

  const { data: leakedRows, error: readError } = await clientB.from('workouts').select('id').eq('id', testId)
  if (readError) throw readError
  if ((leakedRows ?? []).length > 0) throw new Error('RLS falhou: usuario B leu dados do usuario A')

  const { error: forgedWriteError } = await clientB.from('workouts').insert({
    id: `${testId}-forged`,
    user_id: userA.id,
    name: 'Forged write',
    color: '#6366f1',
    icon: 'Dumbbell',
    exercise_ids: [],
    created_at: now,
    updated_at: now,
  })
  if (!forgedWriteError) throw new Error('RLS falhou: usuario B gravou usando o user_id do usuario A')

  console.log('Supabase staging passed: leitura e escrita entre usuarios foram bloqueadas por RLS.')
} finally {
  await clientA.from('workouts').delete().eq('id', testId)
  await Promise.all([clientA.auth.signOut(), clientB.auth.signOut()])
}
