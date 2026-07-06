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

// Sem --output-schema: o schema do OpenAI (response_format) exige strict mode
// (todo campo em `required`, opcionais nullable), incompatível com nosso schema
// draft-07 lenient. A spec (§3) define o contrato como "schema como referência no
// prompt + validate-and-retry com zod", NÃO garantia de schema na chamada. Então
// só capturamos a última mensagem e validamos rio abaixo.
export function buildCodexArgs(opts: { cwd: string; outPath: string }): string[] {
  return [
    'exec',
    '--skip-git-repo-check',
    '--sandbox', 'read-only',
    '-C', opts.cwd,
    '--output-last-message', opts.outPath,
    '-', // prompt via stdin
  ]
}

// A última mensagem do agente deveria ser JSON puro, mas modelos às vezes embrulham
// em cercas ```json``` ou prosa. Tenta parse direto, depois cerca, depois recorta do
// primeiro `{` ao último `}`. Lança se nada for parseável (o chamador trata como
// saída inválida -> retry/erro).
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // continua
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) {
    try {
      return JSON.parse(fence[1].trim())
    } catch {
      // continua
    }
  }
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1))
  }
  throw new SyntaxError('nenhum objeto JSON encontrado na saída do agente')
}

export async function runCodex(opts: {
  cwd: string; prompt: string; outPath: string
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
  // Saída não parseável vira a própria string -> zod rejeita -> retry/erro (a spec
  // recupera determinismo na fronteira de validação, não na chamada).
  try {
    return extractJson(raw)
  } catch {
    return raw
  }
}
