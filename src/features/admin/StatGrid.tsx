export function StatGrid({ stats }: { stats: { label: string; value: string | number }[] }) {
  return (
    <div className="aa-statgrid">
      {stats.map((s) => (
        <div className="aa-stat" key={s.label}>
          <div className="aa-stat-v">{s.value}</div>
          <div className="aa-stat-k">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
