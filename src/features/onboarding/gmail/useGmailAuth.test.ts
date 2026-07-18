import { describe, it, expect, vi } from 'vitest'
import { makeFetchJson } from './useGmailAuth'

describe('makeFetchJson', () => {
  it('prefixa a base da Gmail API e injeta o Bearer', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'm1' }) })) as any
    vi.stubGlobal('fetch', fetchMock)
    const fj = makeFetchJson('tok123')
    const out = await fj('messages/m1')
    expect(out).toEqual({ id: 'm1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/m1')
    expect(init.headers.Authorization).toBe('Bearer tok123')
    vi.unstubAllGlobals()
  })

  it('rejeita em resposta não-ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })) as any)
    await expect(makeFetchJson('t')('messages')).rejects.toThrow('429')
    vi.unstubAllGlobals()
  })
})
