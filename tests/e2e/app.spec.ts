import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('workoutpro.auth.skip', '1')
    window.localStorage.setItem('workoutpro-theme', 'light')
  })
})

test('cria um treino e preserva a rota apos recarregar', async ({ page }) => {
  await page.goto('/workouts/new/')
  await expect(page.getByRole('heading', { name: 'Novo Treino' })).toBeVisible()

  await page.getByLabel('Nome da rotina').fill('Treino E2E')
  await page.getByRole('button', { name: 'Selecionar Supino Reto' }).click()
  await page.getByRole('button', { name: 'Criar', exact: true }).first().click()

  await expect(page.getByRole('heading', { name: 'Treino E2E' })).toBeVisible()
  expect(page.url()).toContain('/workouts/detail/?id=')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Treino E2E' })).toBeVisible()
})

test('executa, finaliza com confirmacao e persiste no historico', async ({ page }) => {
  await page.goto('/workouts/')
  await expect(page.getByRole('heading', { name: 'Treinos' })).toBeVisible()
  await page.getByRole('button', { name: /^Iniciar / }).first().click()
  await expect(page).toHaveURL(/\/workouts\/execute\//)

  await page.getByLabel('Carga, série 1').first().fill('82,5')
  await page.getByLabel('Repetições, série 1').first().fill('10')
  await page.getByRole('button', { name: 'Concluir série 1' }).first().click()
  await expect(page.getByRole('button', { name: 'Pular' })).toBeVisible()
  await expect(page.locator('header').getByText(/^1\/\d+$/)).toBeVisible()

  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Finalizar treino incompleto' })).toBeVisible()
  await page.getByRole('button', { name: 'Finalizar assim' }).click()
  await expect(page.getByRole('heading', { name: 'Treino concluído' })).toBeVisible()

  await page.getByRole('button', { name: 'Voltar ao início' }).click()
  await expect(page).toHaveURL(/\/dashboard\//)
  await expect(page.getByText('Última sessão')).toBeVisible()
  await page.reload()
  await page.goto('/profile/')
  await expect(page.getByTestId('profile-total-workouts')).toHaveText('1')
})

test('exporta, valida e reimporta um backup', async ({ page }) => {
  await page.goto('/profile/')
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Exportar backup/ }).click()
  const download = await downloadPromise
  const backupPath = await download.path()
  expect(backupPath).toBeTruthy()

  await page.locator('input[type="file"][accept=".json"]').setInputFiles(backupPath!)
  await expect(page.getByRole('heading', { name: 'Confirmar importacao' })).toBeVisible()
  await page.getByRole('button', { name: 'Importar', exact: true }).last().click()
  await expect(page.getByText('Backup validado e importado com sucesso.')).toBeVisible()
})

test('rejeita backup invalido sem substituir os dados', async ({ page }) => {
  await page.goto('/profile/')
  await page.locator('input[type="file"][accept=".json"]').setInputFiles({
    name: 'invalido.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"formato":"desconhecido"}'),
  })
  await expect(page.getByText('Nao foi possivel importar. Verifique o arquivo.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible()
})
