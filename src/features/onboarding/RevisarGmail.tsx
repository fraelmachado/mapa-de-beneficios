import { useState } from 'react'
import { useAddGmailSources } from './useAddGmailSources'
import { TriageCard } from './gmail/TriageCard'
import { TriageSummary } from './gmail/TriageSummary'
import type { Finding, GmailSourcePayload, SavedSelection } from './gmail/types'

// Triagem card-a-card: um card por marca, decisão por toque, depois um resumo antes de salvar.
// decision: sourceId → itemId escolhido (tenho essa versão) | null (não tenho). ausente = pendente.
export function RevisarGmail({
  findings, partial, onDone, onBack,
}: {
  findings: Finding[]
  partial: boolean
  onDone: (saved: SavedSelection[]) => void
  onBack?: () => void
}) {
  const add = useAddGmailSources()
  const [decision, setDecision] = useState<Map<string, string | null>>(new Map())
  const [idx, setIdx] = useState(0)
  const [fromSummary, setFromSummary] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const total = findings.length
  const onSummary = idx >= total
  const haveList = findings.filter((f) => typeof decision.get(f.sourceId) === 'string')
  const estValue = haveList.reduce((acc, f) => {
    const it = f.items.find((x) => x.id === decision.get(f.sourceId))
    return acc + (it?.estValueBrl ?? 0)
  }, 0)

  // decide o card atual (itemId = tenho essa versão | null = não tenho) e avança.
  function decide(itemId: string | null) {
    if (saving) return
    const cur = findings[idx]
    if (!cur) return
    setDecision((prev) => new Map(prev).set(cur.sourceId, itemId))
    setSaveError(false) // mexeu no que vai ser salvo → erro antigo não vale mais
    if (fromSummary) {
      setFromSummary(false)
      setIdx(total) // veio do resumo pra editar → volta pro resumo
    } else {
      // idempotente: duplo toque não pula card (o 2º vê idx já adiantado)
      setIdx((i) => (i === idx ? i + 1 : i))
    }
  }

  function goBack() {
    if (saving) return
    if (onSummary) { setIdx(total - 1); return } // resumo → último card
    if (idx > 0) setIdx(idx - 1)
    else onBack?.()
  }

  function editFromSummary(target: number) {
    if (saving) return
    setFromSummary(true)
    setIdx(target)
  }

  async function submit() {
    if (saving) return
    setSaving(true); setSaveError(false)
    try {
      if (haveList.length > 0) {
        const payload: GmailSourcePayload[] = haveList.map((f) => ({
          item_id: decision.get(f.sourceId) as string, source_id: f.sourceId,
          gmail_account: f.evidence.gmailAccount, gmail_message_id: f.evidence.gmailMessageId,
          email_from: f.evidence.emailFrom, email_subject: f.evidence.emailSubject, email_date: f.evidence.emailDate,
        }))
        await add.mutateAsync(payload)
      }
      onDone(haveList.map((f) => ({ finding: f, itemId: decision.get(f.sourceId) as string })))
    } catch {
      setSaving(false); setSaveError(true)
    }
  }

  if (onSummary) {
    return (
      <TriageSummary
        findings={findings} decision={decision} estValue={estValue} partial={partial}
        saving={saving} saveError={saveError}
        onEdit={editFromSummary} onBack={goBack} onSubmit={submit}
      />
    )
  }

  const cur = findings[idx]
  return (
    <TriageCard
      finding={cur}
      decision={decision.get(cur.sourceId)}
      position={idx + 1}
      total={total}
      hasNext={idx + 1 < total}
      onDecide={decide}
      onBack={goBack}
      disabled={saving}
    />
  )
}
