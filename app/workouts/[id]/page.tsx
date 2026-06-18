// Stub route mantida por compatibilidade de build.
// Toda navegação real usa /workouts/detail?id=xxx
// O stub '_' gera um arquivo estático vazio que nunca é acessado pelo usuário.

export const dynamicParams = false

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [{ id: '_' }]
}

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await params
  return null
}
