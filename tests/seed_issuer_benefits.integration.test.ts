import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

async function itemId(slug: string) {
  const db = serviceClient()
  const { data } = await db.from('source_items').select('id').eq('slug', slug).single()
  return data!.id as string
}

describe('seed: benefícios de emissor (caminho direto)', () => {
  it('Ultravioleta destrava Priority Pass, Lounge GRU, pontos/cashback, Nu Viagens e IOF zero', async () => {
    const item = await itemId('nubank-ultravioleta-black')
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [item] })
    const { data, error } = await client.from('my_benefits').select('title')
    expect(error).toBeNull()
    const titles = (data ?? []).map((r) => r.title as string)
    expect(titles.some((t) => /Priority Pass/i.test(t))).toBe(true)
    expect(titles.some((t) => /Lounge.*Guarulhos/i.test(t))).toBe(true)
    expect(titles.some((t) => /Cashback/i.test(t))).toBe(true)
    expect(titles.some((t) => /Nu Viagens/i.test(t))).toBe(true)
    expect(titles.some((t) => /IOF zero/i.test(t))).toBe(true)
  })

  it('Duo Gourmet destrava o 2-por-1', async () => {
    const item = await itemId('inter-duo-gourmet')
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [item] })
    const { data } = await client.from('my_benefits').select('title')
    expect((data ?? []).some((r) => /2 pratos|2 por 1|2-por-1/i.test(r.title as string))).toBe(true)
  })
})
