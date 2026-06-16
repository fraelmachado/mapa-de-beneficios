import type { MyBenefit } from './types'

/** Outros benefícios do usuário catalogados da MESMA fonte oficial (source_url),
 *  exceto o próprio. Ignora source_url nulo. */
export function relatedBySource(all: MyBenefit[], current: MyBenefit): MyBenefit[] {
  if (!current.source_url) return []
  return all.filter((b) => b.id !== current.id && b.source_url === current.source_url)
}
