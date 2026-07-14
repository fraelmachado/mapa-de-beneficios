import { test, expect } from '@playwright/test'
import { assertNoHorizontalOverflow } from './helpers'
import { loginAdmin } from './admin.helpers'

test.beforeEach(async ({ page }, testInfo) => {
  const dark = testInfo.project.name.endsWith('dark')
  await page.addInitScript((theme) => localStorage.setItem('mb-theme', theme), dark ? 'dark' : 'light')
})

test('admin flow: painel → programas (novo + focus-trap) → benefícios → discovery', async ({ page }, testInfo) => {
  const shot = (name: string) => page.screenshot({ path: `test-results/${testInfo.project.name}-admin-${name}.png`, fullPage: true })
  const desktop = testInfo.project.name.startsWith('desktop')

  await loginAdmin(page)

  // /admin — painel
  await expect(page.locator('.aa-statgrid')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await shot('painel')

  // /admin/sources — programas
  await page.goto('/admin/sources')
  await expect(page.getByRole('tab')).toHaveCount(3)
  if (desktop) {
    await expect(page.locator('.aa-side')).toBeVisible()
    await expect(page.locator('.aa-tabbar')).toBeHidden()
  } else {
    await expect(page.locator('.aa-tabbar')).toBeVisible()
    await expect(page.locator('.aa-side')).toBeHidden()
  }
  await assertNoHorizontalOverflow(page)
  await shot('programas')

  // Abrir "Novo programa" — dialog + focus-trap (D12)
  const novoPrograma = page.getByRole('button', { name: /novo programa/i })
  await novoPrograma.click()
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toBeVisible()
  await expect(page.evaluate(() => document.querySelector('dialog[open]')?.contains(document.activeElement))).resolves.toBe(true)
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab')
    await expect(page.evaluate(() => document.querySelector('dialog[open]')?.contains(document.activeElement))).resolves.toBe(true)
  }
  await assertNoHorizontalOverflow(page)
  await shot('novo-programa')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(novoPrograma).toBeFocused()

  // /admin/benefits
  await page.goto('/admin/benefits')
  await expect(page.locator('.aa-search')).toBeVisible()
  await expect(page.locator('.aa-list')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await shot('beneficios')

  // /admin/discovery
  await page.goto('/admin/discovery')
  await expect(page.getByRole('heading', { name: /discovery/i })).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await shot('discovery')
})
