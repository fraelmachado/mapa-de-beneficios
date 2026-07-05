import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const ALLOW = ['PATH', 'HOME', 'CODEX_HOME', 'TERM', 'LANG']
const DENY = /(SUPABASE|SERVICE_ROLE|ANON|VITE_|DATABASE|KEY|SECRET|TOKEN)/i

// Env allowlist: o subprocesso Codex é NÃO-CONFIÁVEL (consome web -> prompt-injection).
// Ele recebe só o que precisa pra autenticar (Codex guarda auth em CODEX_HOME/HOME),
// nunca a service-role key nem env do Supabase. Esta é a trava principal de segurança.
export function sanitizedEnv(parentEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const k of ALLOW) {
    if (parentEnv[k] !== undefined && !DENY.test(k)) env[k] = parentEnv[k]
  }
  return env
}

export function buildCodexArgs(opts: { cwd: string; schemaPath: string; outPath: string }): string[] {
  return [
    'exec',
    '--skip-git-repo-check',
    '--sandbox', 'read-only',
    '-C', opts.cwd,
    '--output-schema', opts.schemaPath,
    '--output-last-message', opts.outPath,
    '-', // prompt via stdin
  ]
}

export async function runCodex(opts: {
  cwd: string; prompt: string; schemaPath: string; outPath: string
}): Promise<unknown> {
  const args = buildCodexArgs(opts)
  await new Promise<void>((resolve, reject) => {
    const child = spawn('codex', args, {
      cwd: opts.cwd,
      env: sanitizedEnv(process.env),
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`codex exit ${code}`))))
    child.stdin.write(opts.prompt)
    child.stdin.end()
  })
  const raw = await readFile(opts.outPath, 'utf8')
  return JSON.parse(raw)
}
