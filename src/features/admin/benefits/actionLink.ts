import { normalizeHttpUrl } from '../../../lib/actionLink'

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

  const normalizedUrl = normalizeHttpUrl(url)
  if (!normalizedUrl) {
    return { ok: false, error: 'Informe uma URL de ação completa e válida.' }
  }

  return {
    ok: true,
    value: { action_url: normalizedUrl, action_label: label },
  }
}
