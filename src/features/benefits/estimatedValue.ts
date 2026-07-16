import type { MyBenefit } from './types'

// ponytail: fallback p/ benefício sem valor no modelo (some quando o seed traz valor)
const FALLBACK_BRL = 180

export function benefitValue(b: Pick<MyBenefit, 'estimated_value_brl'>): number {
  return b.estimated_value_brl ?? FALLBACK_BRL
}

export function sumValue(bs: MyBenefit[]): number {
  return bs.reduce((s, b) => s + benefitValue(b), 0)
}

export function formatBRL(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR')}`
}
