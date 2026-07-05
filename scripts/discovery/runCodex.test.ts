import { describe, it, expect } from 'vitest'
import { sanitizedEnv, buildCodexArgs } from './runCodex'

describe('sanitizedEnv', () => {
  it('remove segredos e mantém só o allowlist', () => {
    const parent = {
      PATH: '/usr/bin', HOME: '/home/x', CODEX_HOME: '/home/x/.codex',
      SUPABASE_SERVICE_ROLE_KEY: 'secret', VITE_SUPABASE_URL: 'https://db',
      SUPABASE_ANON_KEY: 'anon', DATABASE_URL: 'postgres://', SOME_API_KEY: 'k',
    }
    const env = sanitizedEnv(parent)
    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/home/x')
    expect(env.CODEX_HOME).toBe('/home/x/.codex')
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined()
    expect(env.VITE_SUPABASE_URL).toBeUndefined()
    expect(env.SUPABASE_ANON_KEY).toBeUndefined()
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.SOME_API_KEY).toBeUndefined()
  })
})

describe('buildCodexArgs', () => {
  it('roda exec headless, sandbox read-only, com schema e saída em arquivo', () => {
    const args = buildCodexArgs({ cwd: '/tmp/wd', schemaPath: '/tmp/wd/schema.json', outPath: '/tmp/wd/out.json' })
    expect(args[0]).toBe('exec')
    expect(args).toContain('--skip-git-repo-check')
    expect(args).toContain('--sandbox')
    expect(args).toContain('read-only')
    expect(args).toContain('--output-schema')
    expect(args).toContain('/tmp/wd/schema.json')
    expect(args).toContain('--output-last-message')
    expect(args).toContain('/tmp/wd/out.json')
    expect(args).toContain('-C')
    expect(args).toContain('/tmp/wd')
  })
})
