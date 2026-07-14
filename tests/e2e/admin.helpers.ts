import { expect, type Page } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './global-setup'

export async function loginAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: /e-mail/i }).fill(ADMIN_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /entrar/i }).click()
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 })
}
