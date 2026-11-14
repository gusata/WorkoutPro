import { expect, test } from '@playwright/test'

async function prepare(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem('workoutpro.auth.skip', '1')
    window.localStorage.setItem('workoutpro-theme', selectedTheme)
  }, theme)
}

test('biblioteca mobile clara', async ({ page }) => {
  await prepare(page, 'light')
  await page.goto('/workouts/')
  await expect(page.getByRole('heading', { name: 'Treinos' })).toBeVisible()
  await expect(page).toHaveScreenshot('workouts-mobile-light.png', { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.01 })
})

test('perfil mobile escuro', async ({ page }) => {
  await prepare(page, 'dark')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/profile/')
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible()
  await expect(page).toHaveScreenshot('profile-mobile-dark.png', { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.01 })
})

test('execucao mobile sem sobreposicao estrutural', async ({ page }) => {
  await prepare(page, 'light')
  await page.goto('/workouts/')
  await page.getByRole('button', { name: /^Iniciar / }).first().click()
  await expect(page).toHaveURL(/\/workouts\/execute\//)
  await expect(page).toHaveScreenshot('execute-mobile-light.png', { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.01 })
})

test('biblioteca desktop clara', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await prepare(page, 'light')
  await page.goto('/workouts/')
  await expect(page.getByRole('heading', { name: 'Treinos' })).toBeVisible()
  await expect(page).toHaveScreenshot('workouts-desktop-light.png', { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.01 })
})
