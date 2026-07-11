import { test, expect, type Page } from '@playwright/test'

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
}

test.beforeEach(async ({ page }, testInfo) => {
  const dark = testInfo.project.name.endsWith('dark')
  await page.addInitScript((theme) => localStorage.setItem('mb-theme', theme), dark ? 'dark' : 'light')
})

test('onboarding exposes manual flow and disabled Gmail', async ({ page }, testInfo) => {
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: /benefícios esperando por você/i })).toBeVisible()
  await page.getByRole('button', { name: /mapear meus benefícios/i }).click()
  await expect(page.getByRole('button', { name: /gmail.*em breve/i })).toBeDisabled()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-onboarding.png`, fullPage: true })
  await page.getByRole('button', { name: /adicionar manualmente/i }).click()
  await expect(page.getByText(/passo 1 de/i)).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-wizard.png`, fullPage: true })
})

for (const route of ['/painel', '/buscar', '/perfil', '/beneficio/inexistente']) {
  test(`${route} renders without overflow`, async ({ page }, testInfo) => {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await assertNoHorizontalOverflow(page)
    const desktop = testInfo.project.name.startsWith('desktop')
    const bottom = page.locator('.tabbar')
    const sidebar = page.locator('.side')
    const shellRoute = !route.startsWith('/beneficio/')
    if (!shellRoute) {
      await expect(bottom).toHaveCount(0)
      await expect(sidebar).toHaveCount(0)
    } else if (desktop) {
      await expect(bottom).toBeHidden()
      await expect(sidebar).toBeVisible()
    } else {
      await expect(bottom).toBeVisible()
      await expect(sidebar).toBeHidden()
    }
    const slug = route.replaceAll('/', '-') || '-root'
    await page.screenshot({ path: `test-results/${testInfo.project.name}${slug}.png`, fullPage: true })
  })
}

test('manual setup produces a populated radar and navigable detail', async ({ page }, testInfo) => {
  await page.goto('/onboarding?mode=edit')
  await expect(page.getByText(/passo 1 de/i)).toBeVisible()
  for (let step = 0; step < 20; step += 1) {
    if (step === 0) {
      await page.getByRole('button', { name: /^tenho$/i }).click()
      await page.locator('.ob-provider .chip').first().click()
    } else {
      await page.getByRole('button', { name: /n.o tenho/i }).click()
    }
    const conclude = page.getByRole('button', { name: /concluir/i })
    if (await conclude.count()) {
      await conclude.click()
      break
    }
    await page.getByRole('button', { name: /avan.ar/i }).click()
  }
  // tela de conclusão (Radar montado) → Ver meu radar
  await page.getByRole('button', { name: /ver meu radar/i }).click()
  await expect(page).toHaveURL(/\/painel$/, { timeout: 10_000 })
  await expect(page.locator('.pass').first()).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-painel-populado.png`, fullPage: true })
  await page.locator('a[href^="/beneficio/"]').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-detalhe-real.png`, fullPage: true })
})
