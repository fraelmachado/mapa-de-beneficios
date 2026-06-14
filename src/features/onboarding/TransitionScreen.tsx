export function TransitionScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700"
        role="status"
        aria-label="Carregando"
      />
      <p className="text-lg font-medium text-slate-700">Cruzando seus dados com nossa base…</p>
      <p className="text-sm text-slate-500">Buscando benefícios escondidos pra você.</p>
    </div>
  )
}
