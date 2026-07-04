import { z } from 'zod'

const SOURCE_CATEGORY = ['bank_card', 'carrier', 'health', 'corporate_benefits', 'loyalty', 'retail', 'mall'] as const
const SOURCE_KIND = ['card', 'carrier', 'loyalty', 'cpf'] as const
const BENEFIT_CATEGORY = ['travel', 'insurance', 'cashback', 'investback', 'points', 'miles', 'shopping',
  'restaurant', 'airport', 'concierge', 'investment', 'security', 'account_service',
  'international_purchase', 'experience', 'other'] as const
const BENEFIT_SCOPE = ['nacional', 'regional', 'pontual'] as const
const BENEFIT_SOURCE_KIND = ['issuer', 'card_network', 'partner', 'mixed'] as const
const VERIFICATION_STATUS = ['official_confirmed', 'official_needs_regulation_check', 'partner_network',
  'inferred_from_card_network', 'needs_manual_validation'] as const

const url = z.string().url()

const benefitNode = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.enum(BENEFIT_CATEGORY),
  scope: z.enum(BENEFIT_SCOPE).optional(),
  redemption_type: z.string().optional(),
  benefit_source: z.enum(BENEFIT_SOURCE_KIND).optional(),
  long_description: z.string().optional(),
  program: z.string().optional(),
  card_tiers: z.array(z.object({ card_brand: z.string(), card_level: z.string() })).optional(),
  source_url: url,
  source_name: z.string().optional(),
  observed_at: z.string().optional(), // ISO date
  verification_status: z.enum(VERIFICATION_STATUS).optional(),
})

const sourceItemNode = z.object({
  label: z.string().min(1),
  card_brand: z.string().optional(),
  card_level: z.string().optional(),
  display_name: z.string().optional(),
  product_type: z.string().optional(),
  source_url: url,
  verification_status: z.enum(VERIFICATION_STATUS).optional(),
  benefits: z.array(benefitNode).default([]),
})

const sourceNode = z.object({
  name: z.string().min(1),
  source_category: z.enum(SOURCE_CATEGORY),
  kind: z.enum(SOURCE_KIND).optional(),
  source_url: url,
  verification_status: z.enum(VERIFICATION_STATUS).optional(),
  items: z.array(sourceItemNode).default([]),
})

export const candidatesTreeSchema = z.object({ sources: z.array(sourceNode).default([]) })

export type CandidatesTree = z.infer<typeof candidatesTreeSchema>
export type SourceNode = z.infer<typeof sourceNode>
export type SourceItemNode = z.infer<typeof sourceItemNode>
export type BenefitNode = z.infer<typeof benefitNode>

// JSON Schema (draft-07) entregue ao Codex via --output-schema. Escrito à mão para não
// puxar dep de conversão; mantenha alinhado ao zod acima quando editar campos.
export const candidatesJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sources'],
  properties: {
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'source_category', 'source_url', 'items'],
        properties: {
          name: { type: 'string' },
          source_category: { type: 'string', enum: [...SOURCE_CATEGORY] },
          kind: { type: 'string', enum: [...SOURCE_KIND] },
          source_url: { type: 'string' },
          verification_status: { type: 'string', enum: [...VERIFICATION_STATUS] },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'source_url', 'benefits'],
              properties: {
                label: { type: 'string' },
                card_brand: { type: 'string' },
                card_level: { type: 'string' },
                display_name: { type: 'string' },
                product_type: { type: 'string' },
                source_url: { type: 'string' },
                verification_status: { type: 'string', enum: [...VERIFICATION_STATUS] },
                benefits: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['title', 'summary', 'category', 'source_url'],
                    properties: {
                      title: { type: 'string' },
                      summary: { type: 'string' },
                      category: { type: 'string', enum: [...BENEFIT_CATEGORY] },
                      scope: { type: 'string', enum: [...BENEFIT_SCOPE] },
                      redemption_type: { type: 'string' },
                      benefit_source: { type: 'string', enum: [...BENEFIT_SOURCE_KIND] },
                      long_description: { type: 'string' },
                      program: { type: 'string' },
                      card_tiers: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['card_brand', 'card_level'],
                          properties: { card_brand: { type: 'string' }, card_level: { type: 'string' } },
                        },
                      },
                      source_url: { type: 'string' },
                      source_name: { type: 'string' },
                      observed_at: { type: 'string' },
                      verification_status: { type: 'string', enum: [...VERIFICATION_STATUS] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const
