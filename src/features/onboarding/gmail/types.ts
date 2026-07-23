import type { SourceItem } from '../types'
import type { SourceCategory } from '../../benefits/types'

export interface ScanEmail {
  domain: string
  from: string
  subject: string | null
  internalDate: number // ms epoch
  messageId: string
}

export interface EvidenceInput {
  gmailAccount: string
  gmailMessageId: string
  emailFrom: string
  emailSubject: string | null
  emailDate: string // ISO
}

export interface Finding {
  sourceId: string
  provider: string
  logo: string | null
  category: SourceCategory // categoria da marca (eyebrow do card)
  items: SourceItem[] // tiers da marca; length 1 = marca de item único
  evidence: EvidenceInput
}

export interface ScanResult {
  findings: Finding[]
  partial: boolean // algum domínio não pôde ser verificado
}

// seleção confirmada na triagem: o finding + o tier escolhido (itemId).
// leva o tier adiante (tela final) — Finding sozinho não sabe qual versão foi escolhida.
export interface SavedSelection {
  finding: Finding
  itemId: string
}

export interface GmailSourcePayload {
  item_id: string
  source_id: string
  gmail_account: string
  gmail_message_id: string
  email_from: string
  email_subject: string | null
  email_date: string
}
