import { expect, type Page } from '@playwright/test'

export async function assertNoHorizontalOverflow(page: Page) {
  const d = await page.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
  }))
  expect(d.s).toBeLessThanOrEqual(d.c)
}
