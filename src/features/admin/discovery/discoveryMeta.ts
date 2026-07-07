import { categoryToDsCat, type DsCat } from '../../benefits/toPassProps'
import { CATEGORIES, type BenefitCategory, type SourceCategory } from '../../benefits/types'
import { categoryMeta } from '../../onboarding/categoryMeta'

export interface ChipMeta {
  label: string
  colorVar: string
}

const DSCAT_VAR: Record<DsCat, string> = {
  airport: 'var(--c-airport)',
  seguro: 'var(--c-seguro)',
  viagem: 'var(--c-viagem)',
  cashback: 'var(--c-cashback)',
  compras: 'var(--c-compras)',
  pontos: 'var(--c-pontos)',
}

const SOURCE_CAT_COLOR: Record<SourceCategory, string> = {
  bank_card: 'var(--accent)',
  carrier: 'var(--c-pontos)',
  health: 'var(--c-seguro)',
  corporate_benefits: 'var(--c-cashback)',
  loyalty: 'var(--c-pontos)',
  retail: 'var(--c-compras)',
  mall: 'var(--c-viagem)',
}

const BENEFIT_LABEL = new Map(CATEGORIES.map((c) => [c.key, c.label]))

const VERIFICATION_LABEL: Record<string, string> = {
  official_confirmed: 'oficial confirmado',
  official_needs_regulation_check: 'checar regulação',
  partner_network: 'rede parceira',
  inferred_from_card_network: 'inferido da bandeira',
  needs_manual_validation: 'validar manualmente',
}

const JOB_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'pendente', cls: 'queued' },
  processing: { label: 'processando', cls: 'running' },
  done: { label: 'concluído', cls: 'done' },
  error: { label: 'erro', cls: 'error' },
}

export function benefitCategoryChip(cat: string): ChipMeta {
  const label = BENEFIT_LABEL.get(cat as BenefitCategory)
  if (!label) return { label: cat, colorVar: 'var(--muted)' }
  return { label, colorVar: DSCAT_VAR[categoryToDsCat(cat as BenefitCategory)] }
}

export function sourceCategoryChip(cat: string): ChipMeta {
  const color = SOURCE_CAT_COLOR[cat as SourceCategory]
  if (!color) return { label: cat, colorVar: 'var(--muted)' }
  return { label: categoryMeta(cat as SourceCategory).label, colorVar: color }
}

export function verificationLabel(status: string | null | undefined): string | null {
  if (!status) return null
  return VERIFICATION_LABEL[status] ?? null
}

export function jobStatusMeta(status: string): { label: string; cls: string } {
  return JOB_STATUS[status] ?? { label: status, cls: 'queued' }
}
