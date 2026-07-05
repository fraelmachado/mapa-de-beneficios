import { describe, it, expect } from 'vitest'
import { candidatesTreeSchema, candidatesJsonSchema } from './candidatesSchema'

const validTree = {
  sources: [
    {
      name: 'Unimed',
      source_category: 'health',
      source_url: 'https://unimed.coop.br',
      items: [
        {
          label: 'Unimed Nacional',
          source_url: 'https://unimed.coop.br/nacional',
          benefits: [
            {
              title: 'Desconto em farmácias',
              summary: 'Descontos na rede parceira',
              category: 'security',
              source_url: 'https://unimed.coop.br/farmacia',
            },
          ],
        },
      ],
    },
  ],
}

describe('candidatesTreeSchema', () => {
  it('aceita uma árvore válida', () => {
    const parsed = candidatesTreeSchema.safeParse(validTree)
    expect(parsed.success).toBe(true)
  })

  it('rejeita source_category fora da taxonomia', () => {
    const bad = structuredClone(validTree)
    ;(bad.sources[0] as { source_category: string }).source_category = 'nope'
    expect(candidatesTreeSchema.safeParse(bad).success).toBe(false)
  })

  it('rejeita nó sem source_url (regra de procedência)', () => {
    const bad = structuredClone(validTree)
    delete (bad.sources[0] as { source_url?: string }).source_url
    expect(candidatesTreeSchema.safeParse(bad).success).toBe(false)
  })

  it('rejeita benefit sem category', () => {
    const bad = structuredClone(validTree)
    delete (bad.sources[0].items[0].benefits[0] as { category?: string }).category
    expect(candidatesTreeSchema.safeParse(bad).success).toBe(false)
  })

  it('aceita source sem items (default para array vazio)', () => {
    const tree = structuredClone(validTree)
    delete (tree.sources[0] as { items?: unknown }).items
    expect(candidatesTreeSchema.safeParse(tree).success).toBe(true)
  })

  it('exporta um JSON Schema com a raiz sources', () => {
    expect(candidatesJsonSchema).toHaveProperty('properties.sources')
    expect(candidatesJsonSchema).toHaveProperty('type', 'object')
  })

  it('rejeita redemption_type fora do enum do DB', () => {
    const bad = structuredClone(validTree)
    ;(bad.sources[0].items[0].benefits[0] as { redemption_type?: string }).redemption_type = 'not_a_real_type'
    expect(candidatesTreeSchema.safeParse(bad).success).toBe(false)
  })

  it('aceita redemption_type e observed_at válidos (castáveis no DB)', () => {
    const ok = structuredClone(validTree) as { sources: Array<{ items: Array<{ benefits: Array<Record<string, unknown>> }> }> }
    ok.sources[0].items[0].benefits[0].redemption_type = 'statement_credit'
    ok.sources[0].items[0].benefits[0].observed_at = '2026-07-01'
    expect(candidatesTreeSchema.safeParse(ok).success).toBe(true)
  })

  it('rejeita observed_at que não é ISO date (ex: "julho/2026")', () => {
    const bad = structuredClone(validTree) as { sources: Array<{ items: Array<{ benefits: Array<Record<string, unknown>> }> }> }
    bad.sources[0].items[0].benefits[0].observed_at = 'julho/2026'
    expect(candidatesTreeSchema.safeParse(bad).success).toBe(false)
  })
})
