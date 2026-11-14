import { describe, expect, it } from 'vitest'
import { compareSyncVersions } from '@/lib/supabaseSync'

describe('sincronizacao entre aparelhos', () => {
  it('detecta quando o segundo aparelho publicou uma versao mais recente', () => {
    const deviceALocal = new Date('2026-08-19T10:00:00.000Z')
    const deviceBCloud = new Date('2026-08-19T10:05:00.000Z')
    expect(compareSyncVersions(deviceALocal, deviceBCloud)).toBe('remote')
  })

  it('permite que uma resolucao local mais nova substitua a nuvem', () => {
    const cloud = new Date('2026-08-19T10:05:00.000Z')
    const resolvedLocally = new Date('2026-08-19T10:06:00.000Z')
    expect(compareSyncVersions(resolvedLocally, cloud)).toBe('local')
    expect(compareSyncVersions(cloud, cloud)).toBe('equal')
  })
})
