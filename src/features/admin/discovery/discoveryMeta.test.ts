import { describe, it, expect } from 'vitest'
import {
  benefitCategoryChip, sourceCategoryChip, verificationLabel, jobStatusMeta,
} from './discoveryMeta'

describe('discoveryMeta', () => {
  it('benefitCategoryChip usa label pt-BR + cor da DsCat', () => {
    expect(benefitCategoryChip('travel')).toEqual({ label: 'Viagem', colorVar: 'var(--c-viagem)' })
    expect(benefitCategoryChip('other')).toEqual({ label: 'Outros', colorVar: 'var(--c-compras)' })
  })

  it('benefitCategoryChip: categoria desconhecida cai no fallback muted', () => {
    expect(benefitCategoryChip('zzz')).toEqual({ label: 'zzz', colorVar: 'var(--muted)' })
  })

  it('sourceCategoryChip usa label do SOURCE_CATEGORY_META', () => {
    expect(sourceCategoryChip('corporate_benefits'))
      .toEqual({ label: 'Multibenefícios', colorVar: 'var(--c-cashback)' })
    expect(sourceCategoryChip('health'))
      .toEqual({ label: 'Planos de saúde', colorVar: 'var(--c-seguro)' })
  })

  it('verificationLabel traduz e trata vazio', () => {
    expect(verificationLabel('official_confirmed')).toBe('oficial confirmado')
    expect(verificationLabel('needs_manual_validation')).toBe('validar manualmente')
    expect(verificationLabel(null)).toBeNull()
    expect(verificationLabel('')).toBeNull()
    expect(verificationLabel('coisa_estranha')).toBeNull()
  })

  it('jobStatusMeta mapeia status do banco -> label + cls', () => {
    expect(jobStatusMeta('pending')).toEqual({ label: 'pendente', cls: 'queued' })
    expect(jobStatusMeta('processing')).toEqual({ label: 'processando', cls: 'running' })
    expect(jobStatusMeta('done')).toEqual({ label: 'concluído', cls: 'done' })
    expect(jobStatusMeta('error')).toEqual({ label: 'erro', cls: 'error' })
  })
})
