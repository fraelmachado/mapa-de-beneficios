export const ACTION_URL_PATTERN = '^https?://[^\\s/?#]+[^\\s]*$'

const actionUrlPattern = new RegExp(ACTION_URL_PATTERN)

export function normalizeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const url = value.trim()
  if (!actionUrlPattern.test(url)) return null

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}
