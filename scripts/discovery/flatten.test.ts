import { describe, it, expect } from 'vitest'
import { matchStatus, type CatalogSnapshot } from './matchCatalog'
import { flattenTree } from './flatten'
import type { CandidatesTree } from './candidatesSchema'

const emptySnap: CatalogSnapshot = { sources: new Map(), sourceItems: new Map(), benefits: new Map() }

const tree: CandidatesTree = {
  sources: [
    {
      name: 'Unimed', source_category: 'health', source_url: 'https://unimed.coop.br',
      items: [
        {
          label: 'Nacional', source_url: 'https://unimed.coop.br/n',
          benefits: [
            {
              title: 'Farmácia',
              summary: 'desconto',
              category: 'security',
              source_url: 'https://unimed.coop.br/f',
              action_url: 'https://unimed.coop.br/rede-credenciada',
              action_label: 'Ver rede',
            },
          ],
        },
      ],
    },
  ],
}

describe('matchStatus', () => {
  it('slug inexistente -> new', () => {
    expect(matchStatus('source', 'unimed', emptySnap)).toEqual({ match_status: 'new', matched_id: null })
  })
  it('slug existente -> update com matched_id', () => {
    const snap: CatalogSnapshot = { ...emptySnap, sources: new Map([['unimed', 'abc-id']]) }
    expect(matchStatus('source', 'unimed', snap)).toEqual({ match_status: 'update', matched_id: 'abc-id' })
  })
})

describe('flattenTree', () => {
  it('produz 3 candidatos com fingerprints e parent_fingerprint encadeados', () => {
    const flat = flattenTree(tree, emptySnap)
    expect(flat.map((c) => c.entity_type)).toEqual(['source', 'source_item', 'benefit'])

    const [src, item, ben] = flat
    expect(src.fingerprint).toBe('source|unimed')
    expect(src.parent_fingerprint).toBeNull()
    expect((src.payload as { slug: string }).slug).toBe('unimed')

    expect(item.fingerprint).toBe('source_item|unimed|nacional')
    expect(item.parent_fingerprint).toBe('source|unimed')
    expect((item.payload as { slug: string }).slug).toBe('unimed-nacional')

    expect(ben.fingerprint).toBe('benefit|unimed-nacional|farmacia')
    expect(ben.parent_fingerprint).toBe('source_item|unimed|nacional')
    expect((ben.provenance as { source_url: string }).source_url).toBe('https://unimed.coop.br/f')
    expect(ben.payload).toMatchObject({
      action_url: 'https://unimed.coop.br/rede-credenciada',
      action_label: 'Ver rede',
    })
  })

  it('marca match_status=update quando o source já existe no catálogo', () => {
    const snap: CatalogSnapshot = { ...emptySnap, sources: new Map([['unimed', 'existing-id']]) }
    const flat = flattenTree(tree, snap)
    expect(flat[0].match_status).toBe('update')
    expect(flat[0].matched_id).toBe('existing-id')
  })
})
