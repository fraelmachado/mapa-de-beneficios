import type * as React from 'react'

export interface HeroRadarProps {
  count?: number | string
  value?: React.ReactNode
  label?: string
  caption?: React.ReactNode
}

export function HeroRadar({ count = 0, value, label = 'Seu radar', caption }: HeroRadarProps) {
  return (
    <section className="hero-radar" aria-label={label}>
      <span className="hero-radar-orb hero-radar-orb-1" aria-hidden="true" />
      <span className="hero-radar-orb hero-radar-orb-2" aria-hidden="true" />
      <p className="lbl">{label}</p>
      <strong>{count}</strong>
      {value != null ? <div>benefícios ativos · <b>{value}</b> em valor estimado/ano</div> : caption ? <div>{caption}</div> : null}
    </section>
  )
}
