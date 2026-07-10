# Mapa de Benefícios M6a — Fundação do admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status de execução (auditado em 2026-07-10):** implementação concluída no repositório (`9dfd5ce` a `53b7200`), incluindo Storage, login, guard, layout e upload. Testes locais cumulativos aprovados; aplicação das mudanças em produção não foi reauditada nesta rodada.

**Goal:** Tornar o painel admin acessível e seguro: login por e-mail/senha, gate por `is_admin`, layout/rotas `/admin`, bootstrap do 1º admin, e upload de imagens pro Supabase Storage.

**Architecture:** Admin é uma árvore de rotas `/admin` no mesmo SPA, reusando `lib/supabase.ts` + TanStack Query + React Router. Acesso restrito por `useIsAdmin` (lê `profiles.is_admin`) dentro de um `AdminGuard`. Imagens vão pra um bucket público `assets` (escrita só admin via RLS de storage).

**Tech Stack:** React 18, TS, Vite, Tailwind, TanStack Query, React Router, Supabase (Auth + Postgres + Storage), Vitest + Testing Library.

**Pré-requisitos:** M1–M5 + Pluggy (0007) na `main`. Supabase local rodando. `.env.local`. `AuthProvider`/`useSession` já existem; `is_admin()` (security definer) e a RLS de catálogo gateada por admin já existem (M1). Test helpers `tests/helpers/clients.ts` têm `serviceClient`, `userClient`, `adminClient`, `anonClient`.

**Referência:** spec `docs/superpowers/specs/2026-06-15-mapa-de-beneficios-m6-admin-design.md`.

---

## Estrutura de arquivos (M6a)

```
supabase/migrations/0008_storage_assets.sql        # CRIA: bucket assets + policies
src/features/admin/useIsAdmin.ts                    # CRIA
src/features/admin/AdminLogin.tsx (+test)           # CRIA
src/features/admin/AdminGuard.tsx (+test)           # CRIA
src/features/admin/AdminLayout.tsx                  # CRIA
src/features/admin/AdminHome.tsx                    # CRIA
src/features/admin/upload/useUploadAsset.ts         # CRIA
src/features/admin/upload/ImageUpload.tsx (+test)   # CRIA
src/router.tsx                                       # MODIFICA: rotas /admin
tests/admin_isadmin.integration.test.ts             # CRIA
tests/admin_storage.integration.test.ts             # CRIA
scripts/bootstrap-admin.md                           # CRIA: runbook do 1º admin
```

---

## Task 1: Bucket de Storage `assets` + policies

**Files:**
- Create: `supabase/migrations/0008_storage_assets.sql`, `tests/admin_storage.integration.test.ts`

- [ ] **Step 1: Teste de integração que falha**

Create `tests/admin_storage.integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { adminClient, userClient, anonClient } from './helpers/clients'

describe('storage assets', () => {
  it('admin faz upload e leitura é pública; não-admin é negado', async () => {
    const { client: admin } = await adminClient()
    const path = `test/${Date.now()}.txt`
    const up = await admin.storage.from('assets').upload(path, new Blob(['oi']), { contentType: 'text/plain' })
    expect(up.error).toBeNull()

    // leitura pública (sem auth) via URL pública
    const pub = anonClient().storage.from('assets').getPublicUrl(path)
    expect(pub.data.publicUrl).toContain('/assets/')

    // não-admin não consegue subir
    const { client: user } = await userClient()
    const denied = await user.storage.from('assets').upload(`test/x-${Date.now()}.txt`, new Blob(['x']))
    expect(denied.error).not.toBeNull()

    await admin.storage.from('assets').remove([path])
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**

Run: `npm test -- tests/admin_storage.integration.test.ts`
Expected: FAIL (bucket `assets` não existe → upload erra).

- [ ] **Step 3: Migration do bucket + policies**

Create `supabase/migrations/0008_storage_assets.sql`:
```sql
-- Bucket público de imagens do catálogo (logos/banners).
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- Leitura pública dos objetos do bucket.
create policy "assets public read" on storage.objects
  for select
  using (bucket_id = 'assets');

-- Escrita (insert/update/delete) só por admin.
create policy "assets admin write" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'assets' and public.is_admin())
  with check (bucket_id = 'assets' and public.is_admin());
```

- [ ] **Step 4: Aplicar local**

Run: `npx supabase db reset`
Expected: aplica 0001–0008 + seed sem erro.

- [ ] **Step 5: Rodar — ver passar**

Run: `npm test -- tests/admin_storage.integration.test.ts`
Expected: PASS (admin sobe, leitura pública ok, não-admin negado).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0008_storage_assets.sql tests/admin_storage.integration.test.ts
git commit -m "feat: bucket de storage assets (leitura pública, escrita admin)"
```

---

## Task 2: Hook `useIsAdmin`

**Files:**
- Create: `src/features/admin/useIsAdmin.ts`, `tests/admin_isadmin.integration.test.ts`

- [ ] **Step 1: Teste de integração que falha**

Create `tests/admin_isadmin.integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { adminClient, userClient } from './helpers/clients'

async function readIsAdmin(client: Awaited<ReturnType<typeof userClient>>['client']) {
  const { data, error } = await client.from('profiles').select('is_admin').single()
  if (error) throw error
  return data.is_admin as boolean
}

describe('is_admin', () => {
  it('admin lê is_admin=true; usuário comum lê false', async () => {
    const a = await adminClient()
    const u = await userClient()
    expect(await readIsAdmin(a.client)).toBe(true)
    expect(await readIsAdmin(u.client)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar — ver passar (valida a query/RLS; não precisa do hook ainda)**

Run: `npm test -- tests/admin_isadmin.integration.test.ts`
Expected: PASS (a query funciona com a RLS de profiles do M1).

- [ ] **Step 3: Implementar o hook**

Create `src/features/admin/useIsAdmin.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ['is_admin', userId],
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return Boolean(data.is_admin)
    },
  })
}
```

- [ ] **Step 4: Scoped typecheck + commit**

Run: `npx tsc --noEmit 2>&1 | grep -i "admin/useIsAdmin" || echo "sem erros"`
```bash
git add src/features/admin/useIsAdmin.ts tests/admin_isadmin.integration.test.ts
git commit -m "feat: hook useIsAdmin + teste de integração"
```

---

## Task 3: Página de login do admin

**Files:**
- Create: `src/features/admin/AdminLogin.tsx`, `src/features/admin/AdminLogin.test.tsx`

- [ ] **Step 1: Teste de componente que falha**

Create `src/features/admin/AdminLogin.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

const signIn = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => signIn(...a) } },
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

import { AdminLogin } from './AdminLogin'

beforeEach(() => {
  signIn.mockReset()
  navigateMock.mockReset()
})

describe('AdminLogin', () => {
  it('faz login e navega pro /admin', async () => {
    signIn.mockResolvedValue({ data: { session: {} }, error: null })
    renderWithProviders(<AdminLogin />)
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'segredo123' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))
    await waitFor(() => expect(signIn).toHaveBeenCalledWith({ email: 'a@b.com', password: 'segredo123' }))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/admin', { replace: true }))
  })

  it('mostra erro quando o login falha', async () => {
    signIn.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    renderWithProviders(<AdminLogin />)
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'errada' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))
    expect(await screen.findByText(/não foi possível entrar/i)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois implementar.

Create `src/features/admin/AdminLogin.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(false)
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(true)
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin Mapa de Benefícios</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">E-mail</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2" />
        <label className="text-sm font-medium text-slate-700" htmlFor="password">Senha</label>
        <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2" />
        {error && <p className="text-sm text-red-600">Não foi possível entrar. Verifique e-mail e senha.</p>}
        <button type="submit" disabled={loading}
          className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-white disabled:opacity-60">
          Entrar
        </button>
      </form>
    </div>
  )
}
```
Run `npm test -- src/features/admin/AdminLogin.test.tsx` → PASS (2).

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/AdminLogin.tsx src/features/admin/AdminLogin.test.tsx
git commit -m "feat: login do admin (e-mail/senha)"
```

---

## Task 4: AdminGuard + AdminLayout + AdminHome + rotas

**Files:**
- Create: `src/features/admin/AdminGuard.tsx` (+ `.test.tsx`), `AdminLayout.tsx`, `AdminHome.tsx`
- Modify: `src/router.tsx`

- [ ] **Step 1: Teste do AdminGuard que falha**

Create `src/features/admin/AdminGuard.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

let sessionValue: { session: unknown; loading: boolean }
vi.mock('../auth/AuthProvider', () => ({ useSession: () => sessionValue }))

let adminResult: { data: boolean | undefined; isLoading: boolean; error: unknown }
vi.mock('./useIsAdmin', () => ({ useIsAdmin: () => adminResult }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock, Outlet: () => <div>conteúdo-admin</div> }
})

import { AdminGuard } from './AdminGuard'

beforeEach(() => navigateMock.mockReset())

describe('AdminGuard', () => {
  it('admin vê o conteúdo', () => {
    sessionValue = { session: { user: { id: 'a' } }, loading: false }
    adminResult = { data: true, isLoading: false, error: null }
    renderWithProviders(<AdminGuard />)
    expect(screen.getByText('conteúdo-admin')).toBeInTheDocument()
  })

  it('não-admin é redirecionado pro login', async () => {
    sessionValue = { session: { user: { id: 'a' } }, loading: false }
    adminResult = { data: false, isLoading: false, error: null }
    renderWithProviders(<AdminGuard />)
    expect(navigateMock).toHaveBeenCalledWith('/admin/login', { replace: true })
  })

  it('mostra carregando enquanto verifica', () => {
    sessionValue = { session: { user: { id: 'a' } }, loading: false }
    adminResult = { data: undefined, isLoading: true, error: null }
    renderWithProviders(<AdminGuard />)
    expect(screen.getByText(/verificando acesso/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois implementar.

Create `src/features/admin/AdminGuard.tsx`:
```tsx
import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useIsAdmin } from './useIsAdmin'

export function AdminGuard() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { data: isAdmin, isLoading, error } = useIsAdmin(session?.user.id)

  useEffect(() => {
    if (isLoading) return
    if (error || isAdmin === false) navigate('/admin/login', { replace: true })
  }, [isLoading, error, isAdmin, navigate])

  if (isLoading || isAdmin === undefined) {
    return <p className="p-6 text-slate-500">Verificando acesso…</p>
  }
  if (!isAdmin) return null
  return <Outlet />
}
```

Create `src/features/admin/AdminLayout.tsx`:
```tsx
import { Link, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <Link to="/admin" className="font-bold text-slate-900">Admin Mapa de Benefícios</Link>
        <Link to="/admin/sources" className="text-sm text-slate-600">Fontes</Link>
        <Link to="/admin/benefits" className="text-sm text-slate-600">Benefícios</Link>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="ml-auto text-sm text-slate-500"
        >
          Sair
        </button>
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
```

Create `src/features/admin/AdminHome.tsx`:
```tsx
import { Link } from 'react-router-dom'

export function AdminHome() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold text-slate-900">Painel do catálogo</h1>
      <div className="flex flex-col gap-2">
        <Link to="/admin/sources" className="rounded-lg border border-slate-200 p-4 hover:border-slate-300">
          Gerenciar fontes e variantes
        </Link>
        <Link to="/admin/benefits" className="rounded-lg border border-slate-200 p-4 hover:border-slate-300">
          Gerenciar benefícios
        </Link>
      </div>
    </div>
  )
}
```

Run `npm test -- src/features/admin/AdminGuard.test.tsx` → PASS (3).

- [ ] **Step 3: Wire das rotas em `src/router.tsx`**

Add imports:
```tsx
import { AdminLogin } from './features/admin/AdminLogin'
import { AdminGuard } from './features/admin/AdminGuard'
import { AdminLayout } from './features/admin/AdminLayout'
import { AdminHome } from './features/admin/AdminHome'
```
Add routes to the `createBrowserRouter([...])` array (após `/beneficio/:id`):
```tsx
  { path: '/admin/login', element: <AdminLogin /> },
  {
    element: <AdminGuard />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <AdminHome /> },
        ],
      },
    ],
  },
```
(`/admin/sources` e `/admin/benefits` entram no M6b/M6c, sob este mesmo grupo guard+layout.)

- [ ] **Step 4: Build + suíte**

Run: `npm run build` (PASS) e `npm test` (tudo verde).

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/AdminGuard.tsx src/features/admin/AdminGuard.test.tsx src/features/admin/AdminLayout.tsx src/features/admin/AdminHome.tsx src/router.tsx
git commit -m "feat: AdminGuard + AdminLayout + home + rotas /admin"
```

---

## Task 5: Upload de imagens (Storage)

**Files:**
- Create: `src/features/admin/upload/useUploadAsset.ts`, `src/features/admin/upload/ImageUpload.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Hook de upload**

Create `src/features/admin/upload/useUploadAsset.ts`:
```ts
import { supabase } from '../../../lib/supabase'

// Sobe um arquivo pro bucket público `assets` e devolve a URL pública.
export async function uploadAsset(folder: string, file: File): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('assets').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return supabase.storage.from('assets').getPublicUrl(path).data.publicUrl
}
```

- [ ] **Step 2: Teste do ImageUpload que falha**

Create `src/features/admin/upload/ImageUpload.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const uploadAsset = vi.fn()
vi.mock('./useUploadAsset', () => ({ uploadAsset: (...a: unknown[]) => uploadAsset(...a) }))

import { ImageUpload } from './ImageUpload'

beforeEach(() => uploadAsset.mockReset())

describe('ImageUpload', () => {
  it('faz upload e chama onChange com a URL', async () => {
    uploadAsset.mockResolvedValue('https://cdn.test/assets/x.png')
    const onChange = vi.fn()
    render(<ImageUpload folder="sources" value={null} onChange={onChange} />)
    const file = new File(['bytes'], 'logo.png', { type: 'image/png' })
    const input = screen.getByLabelText(/imagem/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://cdn.test/assets/x.png'))
  })

  it('mostra a imagem atual quando há value', () => {
    render(<ImageUpload folder="sources" value="https://cdn.test/a.png" onChange={() => {}} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.test/a.png')
  })
})
```

- [ ] **Step 3: Rodar — ver falhar**, depois implementar.

Create `src/features/admin/upload/ImageUpload.tsx`:
```tsx
import { useState, type ChangeEvent } from 'react'
import { uploadAsset } from './useUploadAsset'

export function ImageUpload({
  folder,
  value,
  onChange,
}: {
  folder: string
  value: string | null
  onChange: (url: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(false)
    try {
      const url = await uploadAsset(folder, file)
      onChange(url)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value && <img src={value} alt="prévia" className="h-12 w-12 rounded object-contain" />}
      <label className="text-sm text-slate-700">
        <span className="sr-only">Imagem</span>
        <input type="file" accept="image/*" aria-label="Imagem" onChange={onFile} />
      </label>
      {busy && <span className="text-xs text-slate-500">enviando…</span>}
      {error && <span className="text-xs text-red-600">falha no upload</span>}
    </div>
  )
}
```
Run `npm test -- src/features/admin/upload/ImageUpload.test.tsx` → PASS (2).

- [ ] **Step 4: Build + suíte + commit**

Run: `npm run build` (PASS), `npm test` (verde).
```bash
git add src/features/admin/upload/
git commit -m "feat: upload de imagens pro Storage (useUploadAsset + ImageUpload)"
```

---

## Task 6: Bootstrap do 1º admin (runbook) + aplicar prod

**Files:**
- Create: `scripts/bootstrap-admin.md`

NOTA: cria credenciais reais — outward-facing. Confirmar e-mail/senha com o usuário antes de criar em produção.

- [ ] **Step 1: Documentar o procedimento**

Create `scripts/bootstrap-admin.md`:
```md
# Bootstrap do 1º admin do Mapa de Benefícios

Cria um usuário com e-mail/senha e marca `is_admin=true`. Requer a service role key.

## Local (Supabase local)
node -e '
const { createClient } = require("@supabase/supabase-js");
const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[1], password = process.argv[2];
(async () => {
  const db = createClient(url, key, { auth: { persistSession:false } });
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm:true });
  if (error) throw error;
  const { error: e2 } = await db.from("profiles").update({ is_admin:true }).eq("id", data.user.id);
  if (e2) throw e2;
  console.log("admin criado:", data.user.id);
})();
' <EMAIL> <SENHA>

## Produção
Mesmo comando, com VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY apontando pro Supabase de produção (valores no env do Dokploy). Alternativamente, via /pg/query + auth admin API com a service role de prod.
```

- [ ] **Step 2: Criar o admin LOCAL (com env do .env.local)**

Run (substituir e-mail/senha reais; carregando o .env.local):
```bash
set -a; . ./.env.local; set +a
node -e 'const {createClient}=require("@supabase/supabase-js");const db=createClient(process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});(async()=>{const {data,error}=await db.auth.admin.createUser({email:process.argv[1],password:process.argv[2],email_confirm:true});if(error)throw error;const {error:e2}=await db.from("profiles").update({is_admin:true}).eq("id",data.user.id);if(e2)throw e2;console.log("admin local:",data.user.id);})()' "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
```
Expected: imprime o id do admin. (Definir `ADMIN_EMAIL`/`ADMIN_PASSWORD` no shell antes.)

- [ ] **Step 3: ⚠️ CONFIRMAR — Criar o admin em PRODUÇÃO**

Após o usuário confirmar e-mail/senha do admin, rodar o mesmo `node -e` com `VITE_SUPABASE_URL=http://benefy-supabase-49f9b6-85-31-230-250.sslip.io` e a `SERVICE_ROLE_KEY` de produção (do env do Dokploy / já conhecida nesta sessão). Verificar login no app: `/admin/login`.

- [ ] **Step 4: Commit**

```bash
git add scripts/bootstrap-admin.md
git commit -m "docs: runbook de bootstrap do 1º admin"
```

---

## Task 7: Aplicar migração de storage em produção + fechar M6a

- [ ] **Step 1: ⚠️ CONFIRMAR — aplicar 0008 em produção**

Aplicar `supabase/migrations/0008_storage_assets.sql` no Supabase de prod via `/pg/query` (service role), como nas migrações anteriores. Verificar que o bucket `assets` existe (`select id from storage.buckets where id='assets'`).

- [ ] **Step 2: Push (auto-deploy do front)**

```bash
git push origin main
```
Expected: webhook redeploya o front com as rotas `/admin`.

- [ ] **Step 3: Smoke**

Abrir `http://<app>/admin/login`, entrar com o admin de prod, cair em `/admin` (home). Non-admin/anon em `/admin` → redireciona pro login.

---

## Definition of Done (M6a)

- [ ] `npm test` inteiro verde (storage, is_admin, login, guard, upload).
- [ ] `npm run build` compila com as rotas `/admin`.
- [ ] Bucket `assets` criado (local + prod): leitura pública, escrita só admin (testado).
- [ ] `/admin/login` autentica admin por e-mail/senha; `AdminGuard` barra não-admin.
- [ ] 1º admin criado (local + prod) e consegue logar.
- [ ] `ImageUpload` sobe pro Storage e devolve URL pública.

**Próximo:** M6b (admin de Sources + source_items + campos Pluggy), depois M6c (Benefits + vínculos + locations).
```
