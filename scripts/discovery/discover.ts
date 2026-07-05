import type { SupabaseClient } from '@supabase/supabase-js'
import { candidatesTreeSchema } from './candidatesSchema'
import { flattenTree } from './flatten'
import { loadCatalogSnapshot } from './catalogSnapshot'

export interface RunJobDeps {
  db: SupabaseClient
  worker: string
  workdir: string
  runAgent: (job: { id: string; brief: string }, ctx: { attemptErrors: string | null }) => Promise<unknown>
}

export async function runJob(deps: RunJobDeps): Promise<{ status: 'done' | 'error' | 'idle'; jobId?: string }> {
  const { db, worker } = deps
  const claim = await db.rpc('claim_discovery_job', { worker })
  if (claim.error) throw claim.error
  const jobs = (claim.data ?? []) as { id: string; brief: string }[]
  if (jobs.length === 0) return { status: 'idle' }
  const job = jobs[0]

  let attemptErrors: string | null = null
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const raw = await deps.runAgent(job, { attemptErrors })
    const parsed = candidatesTreeSchema.safeParse(raw)
    if (parsed.success) {
      const snap = await loadCatalogSnapshot(db)
      const flat = flattenTree(parsed.data, snap).map((c) => ({ ...c, job_id: job.id, review_status: 'pending' as const }))
      // upsert idempotente por fingerprint
      const up = await db.from('discovery_candidates').upsert(flat as never, { onConflict: 'fingerprint' })
      if (up.error) throw up.error
      await db.from('discovery_jobs').update({ status: 'done' }).eq('id', job.id)
      return { status: 'done', jobId: job.id }
    }
    attemptErrors = JSON.stringify(parsed.error.issues)
  }

  await db.from('discovery_jobs').update({ status: 'error', error: attemptErrors }).eq('id', job.id)
  return { status: 'error', jobId: job.id }
}

import { createClient } from '@supabase/supabase-js'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { candidatesJsonSchema } from './candidatesSchema'
import { runCodex } from './runCodex'
import { SOURCE_CATEGORY_TAXONOMY } from './taxonomy'

async function main() {
  loadEnv({ path: '.env.local' })
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const worker = `cli-${process.pid}`

  for (;;) {
    const res = await runJob({
      db, worker, workdir: tmpdir(),
      runAgent: async (job, ctx) => {
        // dir de trabalho ISOLADO fora do repo (scratchpad)
        const wd = await mkdtemp(join(tmpdir(), 'discover-'))
        const snap = await loadCatalogSnapshot(db)
        const context = {
          existing_sources: [...snap.sources.keys()],
          existing_source_items: [...snap.sourceItems.keys()],
          existing_benefits: [...snap.benefits.keys()],
          source_categories: SOURCE_CATEGORY_TAXONOMY,
        }
        const schemaPath = join(wd, 'schema.json')
        const outPath = join(wd, 'out.json')
        await writeFile(schemaPath, JSON.stringify(candidatesJsonSchema))
        const retry = ctx.attemptErrors ? `\nA tentativa anterior falhou na validação:\n${ctx.attemptErrors}\nCorrija.` : ''
        const prompt = [
          `Pesquise na web o brief a seguir e proponha catálogo de benefícios como JSON no schema fornecido.`,
          `Brief: ${job.brief}`,
          `Classifique cada fonte numa source_category da taxonomia. Cite source_url em CADA nó.`,
          `NÃO reproponha itens já existentes (contexto abaixo). Não faça nada além de produzir o JSON final.`,
          `Contexto do catálogo: ${JSON.stringify(context)}`,
          retry,
        ].join('\n')
        return runCodex({ cwd: wd, prompt, schemaPath, outPath })
      },
    })
    if (res.status === 'idle') break
    console.log(`job ${res.jobId ?? '?'} -> ${res.status}`)
  }
}

// Executa só quando chamado como script (não em import de teste).
if (process.argv[1] && process.argv[1].endsWith('discover.ts')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
