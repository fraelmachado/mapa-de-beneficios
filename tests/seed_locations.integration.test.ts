import { describe, it, expect } from 'vitest'
import { serviceClient } from './helpers/clients'

describe('seed: locais de resgate', () => {
  it('Lounge GRU tem aeroporto e escopo de aeroporto', async () => {
    const db = serviceClient()
    const { data: ben } = await db.from('benefits').select('id')
      .eq('slug', 'nubank-ultravioleta-lounge-gru').single()
    const { data } = await db.from('benefit_locations')
      .select('airport_code, scope, geolocation_status').eq('benefit_id', ben!.id)
    expect((data ?? []).some((l) => l.airport_code === 'GRU' && l.scope === 'airport')).toBe(true)
  })

  it('Priority Pass é global_network sem coordenada', async () => {
    const db = serviceClient()
    const { data: ben } = await db.from('benefits').select('id')
      .eq('slug', 'nubank-ultravioleta-priority-pass').single()
    const { data } = await db.from('benefit_locations')
      .select('scope, lat, geolocation_status').eq('benefit_id', ben!.id)
    expect((data ?? []).some((l) => l.scope === 'global_network' && l.lat === null
      && l.geolocation_status === 'not_applicable')).toBe(true)
  })
})
