import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('workoutpro.auth.skip', '1')
    window.localStorage.setItem('workoutpro-theme', 'light')
  })
})

test('reordena arrastando, desliza para remover, desfaz e conclui serie com animacao', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

  await page.goto('/workouts/')
  await expect(page.getByRole('heading', { name: 'Treinos' })).toBeVisible()
  await page.waitForTimeout(800)

  // Open first routine, schedule today
  await page.getByRole('link', { name: /^Abrir / }).first().click()
  await expect(page).toHaveURL(/detail/)
  await page.waitForTimeout(600)
  const names = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  const todayBtn = page.getByRole('button', { name: names[new Date().getDay()], exact: true })
  if ((await todayBtn.getAttribute('aria-pressed')) !== 'true') await todayBtn.click()

  const rows = page.locator('.sortable-row')
  await page.evaluate(() => document.querySelector('.sortable-row')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(200)
  const count = await rows.count()
  const firstName = (await rows.nth(0).locator('.headline').textContent())!
  const secondName = (await rows.nth(1).locator('.headline').textContent())!

  // Drag first below second via the handle
  const handle = page.getByRole('button', { name: `Arrastar para reordenar ${firstName}` })
  const hb = (await handle.boundingBox())!
  const target = (await rows.nth(1).boundingBox())!
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(hb.x + hb.width / 2, hb.y + 20, { steps: 4 })
  await page.mouse.move(hb.x + hb.width / 2, target.y + target.height * 0.75, { steps: 12 })
  await page.waitForTimeout(200)
  await page.mouse.up()
  await page.waitForTimeout(500)
  await expect(rows.nth(0).locator('.headline')).toHaveText(secondName)
  await expect(rows.nth(1).locator('.headline')).toHaveText(firstName)

  // Keyboard reorder back
  const handle2 = page.getByRole('button', { name: `Arrastar para reordenar ${firstName}` })
  await handle2.focus()
  await page.keyboard.press('Space')
  await page.waitForTimeout(150)
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(150)
  await page.keyboard.press('Space')
  await page.waitForTimeout(400)
  await expect(rows.nth(0).locator('.headline')).toHaveText(firstName)

  // Expand + stepper
  await rows.nth(0).locator('button[aria-expanded]').first().click()
  await page.waitForTimeout(400)
  const setsField = rows.nth(0).getByLabel('Séries', { exact: true })
  const before = Number(await setsField.inputValue())
  await rows.nth(0).getByRole('button', { name: 'Aumentar séries' }).click()
  await expect(setsField).toHaveValue(String(before + 1))
  await rows.nth(0).getByRole('button', { name: 'Diminuir séries' }).click()
  await expect(setsField).toHaveValue(String(before))
  await rows.nth(0).locator('button[aria-expanded]').first().click()
  await page.waitForTimeout(600)

  // Swipe to remove second row then undo
  const row = rows.nth(1)
  const rb = (await row.boundingBox())!
  const y = rb.y + 30
  await page.mouse.move(rb.x + rb.width * 0.6, y)
  await page.mouse.down()
  await page.mouse.move(rb.x + rb.width * 0.45, y, { steps: 5 })
  await page.mouse.move(rb.x + rb.width * 0.35, y, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  await row.locator('button', { hasText: 'Remover' }).first().click()
  await expect(page.getByText(`${secondName} removido`)).toBeVisible()
  await expect(rows).toHaveCount(count - 1)
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(rows).toHaveCount(count)
  await expect(rows.nth(1).locator('.headline')).toHaveText(secondName)

  // Back to list: today card
  await page.goto('/workouts/')
  await expect(page.getByRole('region', { name: 'Treino de hoje' })).toBeVisible()
  await page.waitForTimeout(700)

  // Execute
  await page.getByRole('button', { name: /^Iniciar .* agora$/ }).click()
  await expect(page).toHaveURL(/execute/)
  await page.getByRole('button', { name: 'Concluir série 1' }).first().click()
  await page.waitForTimeout(150)
  const remaining = page.getByTestId('rest-remaining')
  await expect(remaining).toHaveText('1:30')
  await page.getByTestId('rest-shorten').click()
  await expect(remaining).toHaveText(/^1:1\d$/)
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await page.getByRole('button', { name: 'Finalizar assim' }).click()
  await expect(page.getByRole('heading', { name: 'Treino concluído' })).toBeVisible()
  expect(errors).toEqual([])
})
