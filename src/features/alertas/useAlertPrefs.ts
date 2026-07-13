import { useState } from 'react'

export interface AlertPrefs {
  v: 1
  optIn: boolean
  novos: boolean
  prazo: boolean
  resumo: boolean
}

export const DEFAULT_PREFS: AlertPrefs = { v: 1, optIn: false, novos: true, prazo: true, resumo: false }

const KEY = 'mb-alerts'

export function readAlertPrefs(): AlertPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.v !== 1) return DEFAULT_PREFS
    return { v: 1, optIn: !!parsed.optIn, novos: !!parsed.novos, prazo: !!parsed.prazo, resumo: !!parsed.resumo }
  } catch {
    return DEFAULT_PREFS
  }
}

export function writeAlertPrefs(p: AlertPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // storage indisponível (mock) — ignora
  }
}

export function useAlertPrefs() {
  const [prefs, setPrefs] = useState<AlertPrefs>(() => readAlertPrefs())
  function set(patch: Partial<AlertPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      writeAlertPrefs(next)
      return next
    })
  }
  return { prefs, set }
}
