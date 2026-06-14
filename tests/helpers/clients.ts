import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function anonClient(): SupabaseClient {
  return createClient(url, anonKey)
}

export function serviceClient(): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Cria um usuário confirmado e devolve um client autenticado como ele.
export async function userClient(): Promise<{ client: SupabaseClient; id: string }> {
  const admin = serviceClient()
  const email = `u${Date.now()}-${Math.floor(performance.now() * 1000)}@test.dev`
  const password = 'test-password-123'
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password })
  if (signInErr) throw signInErr
  return { client, id: data.user!.id }
}

// Cria um usuário, promove a admin via service role e devolve client autenticado.
export async function adminClient(): Promise<{ client: SupabaseClient; id: string }> {
  const { client, id } = await userClient()
  const admin = serviceClient()
  const { error } = await admin.from('profiles').update({ is_admin: true }).eq('id', id)
  if (error) throw error
  return { client, id }
}
