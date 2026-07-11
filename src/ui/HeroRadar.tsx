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
      <p className="lbl">{label}</p>
      <strong>{count}</strong>
      {caption ? <div>{caption}</div> : value != null ? <div>benefícios ativos · <b>{value}</b> em valor estimado/ano</div> : null}
    </section>
  )
}
