import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

async function itemId(slug: string) {
  const db = serviceClient()
  const { data } = await db.from('source_items').select('id').eq('slug', slug).single()
  return data!.id as string
}

describe('seed: benefícios de bandeira (caminho derivado)', () => {
  it('XP Infinite (visa/infinite) herda benefícios Visa Infinite', async () => {
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [await itemId('xp-infinite')] })
    const { data, error } = await client.from('my_benefits').select('title')
    expect(error).toBeNull()
    const titles = (data ?? []).map((r) => r.title as string)
    expect(titles.some((t) => /Veículos de Locadora|veículo de locadora/i.test(t))).toBe(true)
    expect(titles.some((t) => /Emergência Médica/i.test(t))).toBe(true)
    expect(titles.some((t) => /Proteção de Compra/i.test(t))).toBe(true)
  })

  it('Nubank Ultravioleta (mastercard/black) herda benefícios Mastercard Black', async () => {
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [await itemId('nubank-ultravioleta-black')] })
    const { data } = await client.from('my_benefits').select('title')
    const titles = (data ?? []).map((r) => r.title as string)
    expect(titles.some((t) => /Garantia Estendida/i.test(t))).toBe(true)
    expect(titles.some((t) => /Compra Protegida/i.test(t))).toBe(true)
    expect(titles.some((t) => /Concierge/i.test(t))).toBe(true)
  })

  it('Nubank Gold (mastercard/gold) herda Compra Protegida e Proteção de Preço Mastercard Gold', async () => {
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [await itemId('nubank-gold')] })
    const { data } = await client.from('my_benefits').select('title')
    const titles = (data ?? []).map((r) => r.title as string)
    expect(titles.some((t) => /Proteção de Preço/i.test(t))).toBe(true)
    expect(titles.some((t) => /Compra Protegida/i.test(t))).toBe(true)
  })
})
