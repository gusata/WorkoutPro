import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.WORKOUTPRO_AUDIT_URL ?? 'http://localhost:3011'
const outputDir = path.resolve('artifacts/visual-audit')
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const routes = ['dashboard', 'workouts', 'stats', 'achievements', 'profile']

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const report = []

for (const device of [
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, theme: 'light' },
  { name: 'mobile-dark', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, theme: 'dark' },
  { name: 'desktop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, theme: 'light' },
]) {
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.deviceScaleFactor,
    colorScheme: device.theme,
  })
  await context.addInitScript((theme) => {
    window.localStorage.setItem('workoutpro.auth.skip', '1')
    window.localStorage.setItem('workoutpro-theme', theme)
  }, device.theme)
  const page = await context.newPage()
  const consoleErrors = []
  const failedRequests = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`)
  })

  for (const route of routes) {
    await page.goto(`${baseUrl}/${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(route === 'dashboard' ? 2500 : 800)
    const metrics = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth
      const overflowing = [...document.querySelectorAll('body *')]
        .map((element) => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return {
            tag: element.tagName.toLowerCase(),
            className: String(element.className).slice(0, 180),
            text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 100),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            display: style.display,
            position: style.position,
          }
        })
        .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewportWidth + 1))
        .slice(0, 30)

      const buttons = [...document.querySelectorAll('button')].slice(0, 12).map((element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        return {
          text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
          className: String(element.className).slice(0, 200),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
        }
      })

      return {
        title: document.title,
        bottomNavPresent: Boolean(document.querySelector('[data-testid="bottom-nav"]')),
        viewportWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        overflowing,
        buttons,
      }
    })

    await page.screenshot({
      path: path.join(outputDir, `${device.name}-${route}.png`),
      fullPage: true,
    })
    report.push({ device: device.name, route, url: page.url(), expectedBottomNav: route !== 'achievements', ...metrics })
  }

  if (device.name === 'mobile') {
    async function captureFlow(name) {
      await page.waitForTimeout(600)
      const layout = await page.evaluate(() => ({
        title: document.title,
        bottomNavPresent: Boolean(document.querySelector('[data-testid="bottom-nav"]')),
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        overflowing: [...document.querySelectorAll('body *')]
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              tag: element.tagName.toLowerCase(),
              className: String(element.className).slice(0, 160),
              text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }
          })
          .filter((item) => item.width > 0 && (item.left < -1 || item.right > document.documentElement.clientWidth + 1))
          .slice(0, 20),
      }))
      await page.screenshot({ path: path.join(outputDir, `mobile-${name}.png`), fullPage: true })
      report.push({ device: 'mobile', route: name, url: page.url(), expectedBottomNav: false, ...layout })
    }

    await page.goto(`${baseUrl}/workouts/new`, { waitUntil: 'domcontentloaded' })
    await captureFlow('workouts-new')

    await page.goto(`${baseUrl}/privacy`, { waitUntil: 'domcontentloaded' })
    await captureFlow('privacy')

    await page.goto(`${baseUrl}/workouts`, { waitUntil: 'domcontentloaded' })
    const detailHref = await page.locator('a[href*="/workouts/detail"]').first().getAttribute('href')
    if (detailHref) {
      await page.goto(new URL(detailHref, baseUrl).toString(), { waitUntil: 'domcontentloaded' })
      await captureFlow('workout-detail')
      const firstPlanRow = page.locator('section .grouped-surface button').filter({ hasText: /Supino|Agachamento|Remada|Leg Press/ }).first()
      if (await firstPlanRow.count()) await firstPlanRow.click()
      const exerciseLink = page.locator('a[href*="/exercises/detail"]').first()
      const exerciseHref = await exerciseLink.count() ? await exerciseLink.getAttribute('href') : null
      if (exerciseHref) {
        await page.goto(new URL(exerciseHref, baseUrl).toString(), { waitUntil: 'domcontentloaded' })
        await captureFlow('exercise-detail')
      }
    }

    await page.goto(`${baseUrl}/workouts`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /^Iniciar / }).first().click()
    await page.waitForURL(/\/workouts\/execute/)
    await captureFlow('workout-execute')
  }

  report.push({
    device: device.name,
    consoleErrors: [...new Set(consoleErrors)],
    failedRequests: [...new Set(failedRequests)],
  })
  await context.close()
}

await browser.close()
await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2))

const failures = report.filter((entry) => (
  (entry.consoleErrors?.length ?? 0) > 0
  || (entry.failedRequests?.length ?? 0) > 0
  || (entry.overflowing?.length ?? 0) > 0
  || (entry.viewportWidth && (entry.documentWidth > entry.viewportWidth || entry.bodyWidth > entry.viewportWidth))
  || (typeof entry.expectedBottomNav === 'boolean' && entry.bottomNavPresent !== entry.expectedBottomNav)
))

if (failures.length > 0) {
  console.error(JSON.stringify(failures, null, 2))
  process.exitCode = 1
} else {
  console.log(`Visual audit passed: ${report.filter((entry) => entry.route).length} route/device captures without overflow or console errors.`)
}
