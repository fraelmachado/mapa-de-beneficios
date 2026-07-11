import { Button } from '../../ui/Button'

export function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="ob-intro">
      <div className="ob-intro-card">
        <span className="ob-intro-mark" aria-hidden="true">M</span>
        <p className="lbl">Mapa de Benefícios</p>
        <h1>Benefícios que você já tem, finalmente no seu radar.</h1>
        <p>Conte quais programas fazem parte da sua rotina. A gente organiza tudo em um só lugar.</p>
        <Button onClick={onContinue}>Começar</Button>
      </div>
    </main>
  )
}

export function MethodStep({ onManual }: { onManual: () => void }) {
  return (
    <main className="ob-intro">
      <div className="ob-intro-card">
        <p className="lbl">Primeiro passo</p>
        <h1>Como você quer começar?</h1>
        <p>Escolha a forma de montar seu radar.</p>
        <div className="ob-methods">
          <button type="button" className="ob-method" onClick={onManual}>
            <strong>Adicionar manualmente</strong>
            <span>Escolha seus programas e variantes.</span>
          </button>
          <button type="button" className="ob-method" disabled>
            <strong>Conectar Gmail - Em breve</strong>
            <span>A descoberta automática chegará em uma próxima etapa.</span>
          </button>
        </div>
      </div>
    </main>
  )
}
