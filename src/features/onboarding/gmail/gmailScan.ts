import type { Source } from '../types'
import type { ScanEmail, ScanResult } from './types'
import { parseFrom } from './parseFrom'
import { matchSources } from './matchSources'

export type FetchJson = (path: string) => Promise<any>

const MAX_PER_DOMAIN = 3

function header(msg: any, name: string): string | null {
  const h = (msg?.payload?.headers ?? []).find((x: any) => x.name?.toLowerCase() === name.toLowerCase())
  return h?.value ?? null
}

// ponytail: uma marca só precisa de UM e-mail recente; por-domínio evita 1 remetente
// ruidoso mascarar os demais e dispensa paginação. Promise.all sobre ~25 domínios é ok.
async function scanDomain(domain: string, fetchJson: FetchJson): Promise<ScanEmail | null> {
  const q = encodeURIComponent(`from:${domain} newer_than:2y`)
  const list = await fetchJson(`messages?q=${q}&maxResults=${MAX_PER_DOMAIN}`)
  const ids: string[] = (list?.messages ?? []).map((m: any) => m.id)
  let best: ScanEmail | null = null
  for (const id of ids) {
    const msg = await fetchJson(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)
    const from = header(msg, 'From')
    const emailDomain = from ? parseFrom(from) : null
    if (!from || !emailDomain) continue
    const internalDate = Number(msg.internalDate ?? 0)
    if (!best || internalDate > best.internalDate) {
      best = { domain: emailDomain, from, subject: header(msg, 'Subject'), internalDate, messageId: id }
    }
  }
  return best
}

export async function gmailScan(opts: { gmailAccount: string; sources: Source[]; fetchJson: FetchJson }): Promise<ScanResult> {
  const { gmailAccount, sources, fetchJson } = opts
  const domains = [...new Set(sources.flatMap((s) => s.match_domains ?? []))]
  let partial = false
  const results = await Promise.all(
    domains.map((d) => scanDomain(d, fetchJson).catch(() => { partial = true; return null })),
  )
  const emails = results.filter((e): e is ScanEmail => e !== null)
  return { findings: matchSources(emails, sources, gmailAccount), partial }
}
