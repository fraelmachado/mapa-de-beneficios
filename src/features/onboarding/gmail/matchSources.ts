import type { Source } from '../types'
import type { ScanEmail, Finding } from './types'
import { domainMatches } from './parseFrom'

export function matchSources(emails: ScanEmail[], sources: Source[], gmailAccount: string): Finding[] {
  const bySource = new Map<string, { source: Source; email: ScanEmail }>()
  for (const email of emails) {
    const source = sources.find((s) =>
      (s.match_domains ?? []).some((d) => domainMatches(email.domain, d)),
    )
    if (!source) continue
    const prev = bySource.get(source.id)
    if (!prev || email.internalDate > prev.email.internalDate) {
      bySource.set(source.id, { source, email })
    }
  }
  return [...bySource.values()].map(({ source, email }) => ({
    sourceId: source.id,
    provider: source.name,
    logo: source.logo_url,
    items: source.source_items,
    evidence: {
      gmailAccount,
      gmailMessageId: email.messageId,
      emailFrom: email.from,
      emailSubject: email.subject,
      emailDate: new Date(email.internalDate).toISOString(),
    },
  }))
}
