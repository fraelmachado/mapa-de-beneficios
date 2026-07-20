import type { Source, SourceItem } from '../onboarding/types'
import type { EvidenceRow } from './useSourceEvidence'

export interface Program {
  itemId: string; sourceId: string; brand: string; tier: string
  items: SourceItem[]; logo: string | null
  provenance: 'gmail' | 'manual'; when: string; from: string
}
export interface ProgramsSummary { total: number; gmailCount: number; manualCount: number; lastFound: string; account: string }

function relTime(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  if (days < 30) { const w = Math.floor(days / 7); return `há ${w} semana${w > 1 ? 's' : ''}` }
  if (days < 365) { const m = Math.floor(days / 30); return `há ${m} ${m > 1 ? 'meses' : 'mês'}` }
  const y = Math.floor(days / 365); return `há ${y} ano${y > 1 ? 's' : ''}`
}
// mostra o rótulo do item quando é significativo (não placeholder) — single OU multi.
// Ex.: Spotify "Premium" (single) aparece; Vivo "—" (placeholder) não.
function tierLabel(item: SourceItem): string {
  const l = item.label?.trim()
  return !l || l === '—' ? '' : l
}

export function buildPrograms(itemIds: string[], sources: Source[], evidence: EvidenceRow[]): { programs: Program[]; summary: ProgramsSummary } {
  const bySource = new Map<string, { from: string; at: number }>()
  let lastAt = 0, account = ''
  for (const e of evidence) {
    const at = new Date(e.created_at).getTime()
    const prev = bySource.get(e.source_id)
    if (!prev || at > prev.at) bySource.set(e.source_id, { from: e.email_from, at })
    if (at > lastAt) { lastAt = at; account = e.gmail_account }
  }

  const seen = new Set<string>()
  const programs: Program[] = []
  for (const itemId of itemIds) {
    if (seen.has(itemId)) continue
    seen.add(itemId)
    const source = sources.find((s) => s.source_items.some((it) => it.id === itemId))
    if (!source) continue
    const item = source.source_items.find((it) => it.id === itemId)!
    const ev = bySource.get(source.id)
    programs.push({
      itemId, sourceId: source.id, brand: source.name,
      tier: tierLabel(item),
      items: source.source_items, logo: source.logo_url,
      provenance: ev ? 'gmail' : 'manual',
      when: ev ? relTime(ev.at) : '', from: ev?.from ?? '',
    })
  }
  programs.sort((a, b) => {
    const sa = sources.find((s) => s.id === a.sourceId)?.sort_order ?? 0
    const sb = sources.find((s) => s.id === b.sourceId)?.sort_order ?? 0
    return sa - sb || a.brand.localeCompare(b.brand)
  })

  const gmailCount = programs.filter((p) => p.provenance === 'gmail').length
  return { programs, summary: { total: programs.length, gmailCount, manualCount: programs.length - gmailCount, lastFound: lastAt ? relTime(lastAt) : '', account } }
}
