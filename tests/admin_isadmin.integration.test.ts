import { describe, it, expect } from 'vitest'
import { adminClient, userClient } from './helpers/clients'

async function readIsAdmin(
  client: Awaited<ReturnType<typeof userClient>>['client'],
  id: string,
) {
  const { data, error } = await client.from('profiles').select('is_admin').eq('id', id).single()
  if (error) throw error
  return data.is_admin as boolean
}

describe('is_admin', () => {
  it('admin lê is_admin=true; usuário comum lê false', async () => {
    const a = await adminClient()
    const u = await userClient()
    expect(await readIsAdmin(a.client, a.id)).toBe(true)
    expect(await readIsAdmin(u.client, u.id)).toBe(false)
  })
})
