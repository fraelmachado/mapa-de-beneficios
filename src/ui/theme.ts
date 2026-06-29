export type Theme = 'light' | 'dark'

const KEY = 'mb-theme'

function systemTheme(): Theme {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
  } catch {
    /* noop */
  }
  return 'light'
}

/** Aplica o tema salvo (ou o do sistema) no <html>. Retorna o tema aplicado. */
export function initTheme(): Theme {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(KEY)
  } catch {
    /* noop */
  }
  const theme: Theme = saved === 'dark' || saved === 'light' ? saved : systemTheme()
  document.documentElement.setAttribute('data-theme', theme)
  return theme
}

/** Inverte claro/escuro, aplica no <html> e persiste. Retorna o novo tema. */
export function toggleTheme(): Theme {
  const cur = document.documentElement.getAttribute('data-theme')
  const next: Theme = cur === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* noop */
  }
  return next
}
