// Uso: node scripts/gen-supabase-keys.mjs
// Gera JWT_SECRET e as chaves ANON/SERVICE_ROLE assinadas com ele (HS256),
// + uma POSTGRES_PASSWORD. Saída só no stdout — NÃO commitar os valores.
import crypto from 'node:crypto'

const jwtSecret = crypto.randomBytes(32).toString('hex')
const pgPassword = crypto.randomBytes(24).toString('base64url')

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function sign(payload) {
  const head = b64url({ alg: 'HS256', typ: 'JWT' })
  const body = b64url(payload)
  const sig = crypto.createHmac('sha256', jwtSecret).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

const iat = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000)
const exp = iat + 10 * 365 * 24 * 3600 // ~10 anos

console.log('POSTGRES_PASSWORD=' + pgPassword)
console.log('JWT_SECRET=' + jwtSecret)
console.log('ANON_KEY=' + sign({ role: 'anon', iss: 'supabase', iat, exp }))
console.log('SERVICE_ROLE_KEY=' + sign({ role: 'service_role', iss: 'supabase', iat, exp }))
console.log('DASHBOARD_PASSWORD=' + crypto.randomBytes(16).toString('base64url'))
