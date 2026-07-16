import { useSession } from '../auth/AuthProvider'
import { useMyBenefits } from '../benefits/useMyBenefits'
import { benefitValue, sumValue, formatBRL } from '../benefits/estimatedValue'
import { Button } from '../../ui/Button'

export interface SummaryGroup {
  label: string
  items: { provider: string; variant: string }[]
}

export function RadarMontado({ groups, onView }: { groups: SummaryGroup[]; onView: () => void }) {
  const { session } = useSession()
  const benefits = useMyBenefits(session?.user.id).data ?? []
  const benefitCount = benefits.length
  const programsCount = groups.reduce((n, g) => n + g.items.length, 0)
  const value = formatBRL(sumValue(benefits))
  // valor por programa = soma dos benefícios atribuídos àquele provedor (via origins)
  const valueByProvider = new Map<string, number>()
  for (const b of benefits) {
    for (const o of b.origins) {
      valueByProvider.set(o.provider, (valueByProvider.get(o.provider) ?? 0) + benefitValue(b))
    }
  }

  return (
    <div className="ob-done">
      <div className="ob-done-inner">
        <span className="ob-done-check" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
        <p className="lbl ob-done-eyebrow">Tudo pronto</p>
        <h1>Montamos seu radar</h1>
        <p className="ob-done-sub">Com base nos programas que você marcou, já sabemos exatamente o que buscar pra você.</p>

        <div className="ob-done-card">
          <span className="ob-done-orb ob-done-orb-1" aria-hidden="true" />
          <div className="ob-done-card-top">
            <div>
              <p className="ob-done-card-lbl">Benefícios mapeados</p>
              <div className="ob-done-count">{benefitCount}</div>
            </div>
            <div className="ob-done-value-wrap">
              <p className="ob-done-card-lbl">valor estimado</p>
              <div className="ob-done-value">{value}<span>/ano</span></div>
            </div>
          </div>
          <div className="ob-done-progline">em <b>{programsCount}</b> programa{programsCount === 1 ? '' : 's'} conectado{programsCount === 1 ? '' : 's'} ao seu radar</div>
        </div>

        {programsCount > 0 ? (
          <>
            <h2 className="ob-done-h2">Seus programas</h2>
            {groups.map((g) => (
              <div key={g.label} className="ob-done-group">
                <div className="ob-done-group-head">
                  <span className="ob-done-group-dot" aria-hidden="true" />
                  <span className="ob-done-group-label">{g.label}</span>
                </div>
                <div className="ob-done-list">
                  {g.items.map((it, i) => (
                    <div key={`${it.provider}-${i}`} className="ob-done-prog">
                      <span className="ob-done-prog-mark" aria-hidden="true">{it.provider.charAt(0).toUpperCase()}</span>
                      <span className="ob-done-prog-body">
                        <strong>{it.provider}</strong>
                        <span>{it.variant}</span>
                      </span>
                      <span className="ob-done-prog-est"><span>≈</span> {formatBRL(valueByProvider.get(it.provider) ?? 0)}<span>/ano</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <p className="ob-done-empty">Nenhum programa selecionado ainda.</p>
        )}
      </div>
      <div className="ob-foot">
        <div className="ob-foot-inner">
          <div className="ob-cta"><Button onClick={onView}>Ver meu radar →</Button></div>
        </div>
      </div>
    </div>
  )
}
