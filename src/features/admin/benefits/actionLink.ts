export type ActionLinkValue = {
  action_url: string | null
  action_label: string | null
}

export type ActionLinkResult =
  | { ok: true; value: ActionLinkValue }
  | { ok: false; error: string }

export function normalizeActionLink(actionUrl: string, actionLabel: string): ActionLinkResult {
  const url = actionUrl.trim()
  const label = actionLabel.trim()

  if (!url && !label) {
    return { ok: true, value: { action_url: null, action_label: null } }
  }

  if (!url || !label) {
    return { ok: false, error: 'Informe a URL e o rótulo da ação juntos.' }
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'A URL da ação deve usar http ou https.' }
    }
  } catch {
    return { ok: false, error: 'Informe uma URL de ação completa e válida.' }
  }

  return {
    ok: true,
    value: { action_url: url, action_label: label },
  }
}
