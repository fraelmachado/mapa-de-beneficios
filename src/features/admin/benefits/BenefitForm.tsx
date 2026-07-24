import { useState, type FormEvent, type ReactNode } from 'react'
import { Input } from '../../../ui/Input'
import { Button } from '../../../ui/Button'
import { ImageUpload } from '../upload/ImageUpload'
import { BenefitSourcesEditor } from './BenefitSourcesEditor'
import { CATEGORIES, type BenefitCategory } from '../../benefits/types'
import type { SourceRow } from '../sources/types'
import type { BenefitInput, BenefitRow, BenefitScope } from './types'
import { normalizeActionLink } from './actionLink'

const SCOPES: BenefitScope[] = ['nacional', 'regional', 'pontual']

export function BenefitForm({
  initial,
  sources,
  saving = false,
  error = null,
  onSubmit,
  onCancel,
  children,
}: {
  initial: BenefitRow | null
  sources: SourceRow[]
  saving?: boolean
  error?: string | null
  onSubmit: (payload: { input: BenefitInput; sourceItemIds: string[] }) => void
  onCancel: () => void
  children?: ReactNode
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [category, setCategory] = useState<BenefitCategory>(initial?.category ?? 'shopping')
  const [scope, setScope] = useState<BenefitScope>(initial?.scope ?? 'nacional')
  const [uf, setUf] = useState(initial?.uf ?? '')
  const [steps, setSteps] = useState(initial?.steps ?? '')
  const [partner, setPartner] = useState(initial?.partner_name ?? '')
  const [validUntil, setValidUntil] = useState(initial?.valid_until ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null)
  const [actionUrl, setActionUrl] = useState(initial?.action_url ?? '')
  const [actionLabel, setActionLabel] = useState(initial?.action_label ?? '')
  const [actionError, setActionError] = useState<string | null>(null)
  const [requiredErrors, setRequiredErrors] = useState({ title: false, summary: false })
  const [active, setActive] = useState(initial?.active ?? true)
  const [sourceItemIds, setSourceItemIds] = useState<string[]>(
    initial?.benefit_sources.map((b) => b.source_item_id) ?? [],
  )

  function submit(e: FormEvent) {
    e.preventDefault()
    const missingRequired = {
      title: title.trim().length === 0,
      summary: summary.trim().length === 0,
    }
    setRequiredErrors(missingRequired)
    if (missingRequired.title || missingRequired.summary) return

    const action = normalizeActionLink(actionUrl, actionLabel)
    if (!action.ok) {
      setActionError(action.error)
      return
    }
    setActionError(null)

    onSubmit({
      input: {
        title,
        summary,
        category,
        scope,
        uf: uf || null,
        steps: steps || null,
        partner_name: partner || null,
        valid_until: validUntil || null,
        image_url: imageUrl,
        action_url: action.value.action_url,
        action_label: action.value.action_label,
        active,
      },
      sourceItemIds,
    })
  }

  return (
    <form noValidate onSubmit={submit} style={{ display: 'flex', flexDirection: 'column' }}>
      <label className="aa-fieldlbl" htmlFor="b-title">Título</label>
      <Input
        id="b-title"
        required
        value={title}
        aria-describedby={requiredErrors.title ? 'b-title-error' : undefined}
        aria-invalid={requiredErrors.title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {requiredErrors.title ? <p id="b-title-error" role="alert">Informe o título.</p> : null}

      <label className="aa-fieldlbl" htmlFor="b-summary">Resumo</label>
      <Input
        id="b-summary"
        required
        value={summary}
        aria-describedby={requiredErrors.summary ? 'b-summary-error' : undefined}
        aria-invalid={requiredErrors.summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      {requiredErrors.summary ? <p id="b-summary-error" role="alert">Informe o resumo.</p> : null}

      <label className="aa-fieldlbl" htmlFor="b-cat">Categoria</label>
      <select id="b-cat" className="aa-select" value={category} onChange={(e) => setCategory(e.target.value as BenefitCategory)}>
        {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>

      <label className="aa-fieldlbl" htmlFor="b-partner">Parceiro</label>
      <Input id="b-partner" value={partner} onChange={(e) => setPartner(e.target.value)} />

      <label className="aa-check">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo
      </label>

      <details className="aa-more">
        <summary>Mais opções</summary>

        <label className="aa-fieldlbl" htmlFor="b-scope">Abrangência</label>
        <select id="b-scope" className="aa-select" value={scope} onChange={(e) => setScope(e.target.value as BenefitScope)}>
          {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <label className="aa-fieldlbl" htmlFor="b-uf">UF (se regional)</label>
        <Input id="b-uf" value={uf} onChange={(e) => setUf(e.target.value)} />

        <label className="aa-fieldlbl" htmlFor="b-steps">Passo a passo</label>
        <textarea id="b-steps" value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} />

        <label className="aa-fieldlbl" htmlFor="b-valid">Validade</label>
        <Input id="b-valid" type="date" value={validUntil ?? ''} onChange={(e) => setValidUntil(e.target.value)} />

        <span className="aa-fieldlbl">Banner</span>
        <ImageUpload folder="benefits" value={imageUrl} onChange={setImageUrl} />

        <label className="aa-fieldlbl" htmlFor="b-aurl">URL de ação</label>
        <Input
          id="b-aurl"
          type="url"
          value={actionUrl}
          aria-describedby={actionError ? 'b-action-error' : undefined}
          aria-invalid={Boolean(actionError)}
          onChange={(e) => setActionUrl(e.target.value)}
        />

        <label className="aa-fieldlbl" htmlFor="b-alabel">Rótulo da ação</label>
        <Input
          id="b-alabel"
          value={actionLabel}
          aria-describedby={actionError ? 'b-action-error' : undefined}
          aria-invalid={Boolean(actionError)}
          onChange={(e) => setActionLabel(e.target.value)}
        />
        {actionError ? <p id="b-action-error" role="alert">{actionError}</p> : null}

        {children}
      </details>

      <BenefitSourcesEditor sources={sources} selected={sourceItemIds} onChange={setSourceItemIds} />

      {error && <p role="alert">{error}</p>}

      <div className="aa-dialog-actions">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="ink" type="submit" disabled={saving}>Salvar</Button>
      </div>
    </form>
  )
}
