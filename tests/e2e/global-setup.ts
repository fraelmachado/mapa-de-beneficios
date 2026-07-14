import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

export const ADMIN_EMAIL = 'admin-e2e@test.dev'
export const ADMIN_PASSWORD = 'admin-e2e-123'

export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) throw new Error('global-setup: VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes (.env.local)')
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

  const created = await admin.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true })
  let id = created.data?.user?.id
  if (!id) {
    if (created.error && !/already been registered|already exists/i.test(created.error.message)) throw created.error
    // já existe: pagina até achar
    for (let page = 1; !id && page <= 20; page += 1) {
      const list = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (list.error) throw list.error
      id = list.data.users.find((u) => u.email === ADMIN_EMAIL)?.id
      if (list.data.users.length < 200) break
    }
  }
  if (!id) throw new Error('global-setup: não foi possível resolver o usuário admin')
  if (!created.data?.user?.id) {
    // já existia: garante a senha conhecida (idempotência entre execuções)
    const pw = await admin.auth.admin.updateUserById(id, { password: ADMIN_PASSWORD })
    if (pw.error) throw pw.error
  }

  const upd = await admin.from('profiles').update({ is_admin: true }).eq('id', id)
  if (upd.error) throw upd.error
}
