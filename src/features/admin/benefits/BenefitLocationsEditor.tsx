import { useState } from 'react'
import { Input } from '../../../ui/Input'
import { Button } from '../../../ui/Button'
import { useSaveBenefitLocation, useDeleteBenefitLocation } from './useBenefitLocations'
import type { BenefitLocationRow } from './types'

export function BenefitLocationsEditor({ benefitId, locations }: { benefitId: string; locations: BenefitLocationRow[] }) {
  const save = useSaveBenefitLocation()
  const del = useDeleteBenefitLocation()
  const [name, setName] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [city, setCity] = useState('')
  const [uf, setUf] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  async function add() {
    if (!name.trim() || lat === '' || lng === '') return
    await save.mutateAsync({
      benefit_id: benefitId,
      name: name.trim(),
      lat: Number(lat),
      lng: Number(lng),
      address: null,
      city: city || null,
      uf: uf || null,
      radius_m: null,
      active: true,
    })
    setName(''); setLat(''); setLng(''); setCity(''); setUf('')
  }

  async function remove(id: string) {
    await del.mutateAsync(id)
    setConfirmingId(null)
  }

  return (
    <div className="aa-items">
      <h3 className="aa-fieldlbl">Locais (geo)</h3>
      <ul className="aa-itemlist">
        {locations.map((l) => (
          <li key={l.id} className="aa-itemrow">
            <span>{l.name}</span>
            <span className="muted">{l.lat}, {l.lng}{l.city ? ` · ${l.city}` : ''}</span>
            {confirmingId === l.id ? (
              <span className="aa-act">
                <button type="button" onClick={() => remove(l.id)}>Confirmar?</button>
                <button type="button" onClick={() => setConfirmingId(null)}>Cancelar</button>
              </span>
            ) : (
              <button type="button" aria-label={`remover ${l.name}`} onClick={() => setConfirmingId(l.id)} className="aa-itemdel">×</button>
            )}
          </li>
        ))}
        {locations.length === 0 && <li className="muted">Nenhum local.</li>}
      </ul>
      <div className="aa-itemadd">
        <label className="aa-fieldlbl" htmlFor="bl-name">nome do local</label>
        <Input id="bl-name" ariaLabel="nome do local" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="aa-fieldlbl" htmlFor="bl-lat">lat</label>
        <Input id="bl-lat" ariaLabel="lat" value={lat} onChange={(e) => setLat(e.target.value)} />
        <label className="aa-fieldlbl" htmlFor="bl-lng">lng</label>
        <Input id="bl-lng" ariaLabel="lng" value={lng} onChange={(e) => setLng(e.target.value)} />
        <label className="aa-fieldlbl" htmlFor="bl-city">cidade</label>
        <Input id="bl-city" ariaLabel="cidade" value={city} onChange={(e) => setCity(e.target.value)} />
        <label className="aa-fieldlbl" htmlFor="bl-uf">uf</label>
        <Input id="bl-uf" ariaLabel="uf" value={uf} onChange={(e) => setUf(e.target.value)} />
        <Button variant="ink" onClick={add}>Adicionar local</Button>
      </div>
    </div>
  )
}
