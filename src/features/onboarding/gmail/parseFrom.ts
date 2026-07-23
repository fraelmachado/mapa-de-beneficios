/** Domínio do primeiro endereço de um header From, em minúsculas. `null` se inválido. */
export function parseFrom(header: string): string | null {
  const first = header.split(',')[0] ?? ''
  const angle = first.match(/<([^>]+)>/)
  const addr = (angle ? angle[1] : first).trim()
  const at = addr.lastIndexOf('@')
  if (at < 0) return null
  const domain = addr.slice(at + 1).trim().toLowerCase().replace(/\.+$/, '')
  return domain.includes('.') ? domain : null
}

/** Só o endereço do header From, sem o nome de exibição (que repetiria a marca no card). */
export function fromAddress(header: string): string {
  const first = header.split(',')[0] ?? ''
  const angle = first.match(/<([^>]+)>/)
  return (angle ? angle[1] : first).trim()
}

/** Casa por boundary de label: `matchDomain` ou um subdomínio dele. Rejeita colisão de sufixo. */
export function domainMatches(emailDomain: string, matchDomain: string): boolean {
  const e = emailDomain.toLowerCase()
  const m = matchDomain.toLowerCase()
  return e === m || e.endsWith('.' + m)
}
