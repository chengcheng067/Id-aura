import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getGroupedByPrimaryCategory,
  getSpecByCategory,
  searchSpecs,
  getAllSpecs,
  setSpecsData,
  getSpecsVersion,
  getAppInfo,
  setAppInfo,
  compareVersion,
  initSpecs,
  checkAppUpdate,
  refreshSpecsData,
} from './specs'
import {
  specsData as BUNDLED_DATA,
  specsVersion as BUNDLED_VERSION,
  specsApp as BUNDLED_APP,
} from './specs.bundled.js'

// Keep module-level runtime state pristine between tests.
afterEach(() => {
  setSpecsData(BUNDLED_DATA, BUNDLED_VERSION)
  setAppInfo(BUNDLED_APP)
  vi.unstubAllGlobals()
})

describe('specs data layer (P0 规范库外置化)', () => {
  it('loads the built-in fallback data', () => {
    const all = getAllSpecs()
    expect(Object.keys(all).length).toBeGreaterThan(40)
    expect(all.hotpot.name).toBe('火锅店')
  })

  it('getSpecByCategory returns a category with sections/items', () => {
    const c = getSpecByCategory('hotpot')
    expect(c.sections.length).toBeGreaterThan(0)
    expect(c.sections[0].items[0]).toHaveProperty('label')
    expect(c.sections[0].items[0]).toHaveProperty('value')
  })

  it('getGroupedByPrimaryCategory groups by primary + sub category', () => {
    const g = getGroupedByPrimaryCategory()
    expect(g['室内设计规范']['餐饮工装']).toBeDefined()
    expect(g['室内设计规范']['餐饮工装'][0].id).toBe('hotpot')
    expect(g['室内设计规范']['餐饮工装'][0]).toHaveProperty('itemCount')
  })

  it('searchSpecs finds entries by keyword', () => {
    const r = searchSpecs('排烟')
    expect(r.length).toBeGreaterThan(0)
    expect(r[0]).toHaveProperty('categoryName')
  })

  it('setSpecsData replaces data and bumps version (and can be restored)', () => {
    const before = getSpecsVersion()
    const original = getAllSpecs()
    expect(() => setSpecsData({ custom: { sections: [] } }, '9.9.9')).not.toThrow()
    expect(getSpecsVersion()).toBe('9.9.9')
    expect(getSpecByCategory('custom')).toBeDefined()
    // restore
    setSpecsData(original, before)
    expect(getSpecsVersion()).toBe(before)
  })

  it('initSpecs treats the remote as source of truth (overwrites even when remote version is older)', async () => {
    const fakeJson = {
      version: '0.0.1',
      data: {
        online: { name: '线上独有品类', category: '室内设计规范', subCategory: '餐饮工装', icon: 'o', description: '', sections: [] },
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => fakeJson }))

    let lastUpdate
    await initSpecs({ onUpdate: (i) => { lastUpdate = i } })

    expect(getSpecByCategory('online')).toBeDefined()
    expect(lastUpdate.source).toContain('spec.json')
    expect(lastUpdate.version).toBe('0.0.1')
    expect(lastUpdate.categories).toBe(1)
    expect(lastUpdate.success).toBe(true)
    expect(lastUpdate.error).toBeNull()
  })
})

describe('app self-update info (Channel A — checkAppUpdate)', () => {
  it('starts from the bundled app node', () => {
    const app = getAppInfo()
    expect(app).toBeTruthy()
    expect(app.latestVersion).toBe('2.10.1')
    expect(app.downloadUrl).toContain('github.com')
  })

  it('setAppInfo overrides and getAppInfo reflects it', () => {
    setAppInfo({ latestVersion: '5.0.0', downloadUrl: 'https://x/y' })
    expect(getAppInfo().latestVersion).toBe('5.0.0')
    setAppInfo(BUNDLED_APP)
    expect(getAppInfo().latestVersion).toBe('2.10.1')
  })

  it('compareVersion is a tolerant semver comparator', () => {
    expect(compareVersion('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersion('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersion('1.9.9', '2.0.0')).toBe(-1)
    expect(compareVersion('1.2', '1.2.0')).toBe(0)
    expect(compareVersion('1.10.0', '1.9.0')).toBe(1)
    expect(compareVersion('1.x', '1.0.0')).toBe(0)
    expect(compareVersion('2', '1.9.9')).toBe(1)
    expect(compareVersion('', '0.0.1')).toBe(-1)
  })

  it('checkAppUpdate returns bundled app when network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const result = await checkAppUpdate()
    expect(result.app.latestVersion).toBe('2.10.1')
    expect(result.source).toBe('builtin')
    expect(result.error).not.toBeNull()
  })

  it('checkAppUpdate picks up remote app node (does NOT touch spec data)', async () => {
    const fakeJson = {
      version: '9.9.9',
      data: { x: { name: 'X', category: '室内设计规范', subCategory: '餐饮工装', icon: 'x', description: '', sections: [] } },
      app: { latestVersion: '3.0.0', minVersion: '2.9.0', critical: true, downloadUrl: 'https://example.com/dl', releaseNotes: '• 重大更新', publishDate: '2026-07-14' },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => fakeJson }))

    const result = await checkAppUpdate()

    // App info updated
    expect(result.app.latestVersion).toBe('3.0.0')
    expect(getAppInfo().latestVersion).toBe('3.0.0')

    // But spec data is NOT touched — still bundled
    expect(getSpecsVersion()).toBe(BUNDLED_VERSION)
    expect(getSpecByCategory('x')).toBeNull()  // remote data NOT applied
  })
})

describe('specs data refresh (Channel B — refreshSpecsData)', () => {
  it('fetchJson bypasses HTTP cache (no-store + cache-bust query)', async () => {
    let capturedUrl = ''
    let capturedOpts = {}
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((u, opts) => {
        capturedUrl = u
        capturedOpts = opts || {}
        return Promise.resolve({ ok: true, json: async () => ({ version: '1.1.0', data: {} }) })
      }),
    )

    await refreshSpecsData()

    // cache-bust query param appended
    expect(capturedUrl).toContain('_=')
    // no-store must be set so browser/Electron cache is bypassed
    expect(capturedOpts.cache).toBe('no-store')
  })

  it('refreshSpecsData overwrites local with remote data (SOURCE OF TRUTH)', async () => {
    const fakeJson = {
      version: '0.0.1',
      data: {
        fresh: { name: '新鲜品类', category: '建筑设计规范', subCategory: '办公建筑', icon: 'f', description: '', sections: [{ title: 'T', items: [{ label: 'L', value: 'V', note: '', priority: '高' }] }] },
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => fakeJson }))

    const result = await refreshSpecsData()

    expect(result.success).toBe(true)
    expect(result.version).toBe('0.0.1')
    expect(result.categories).toBe(1)
    expect(result.error).toBeNull()

    // Data actually replaced
    expect(getSpecByCategory('fresh')).toBeDefined()
    expect(getSpecsVersion()).toBe('0.0.1')
  })

  it('refreshSpecsData returns error when all sources fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await refreshSpecsData()

    expect(result.success).toBe(false)
    expect(result.error).not.toBeNull()
    // Should still report current state
    expect(result.version).toBeDefined()
  })

  it('refreshSpecsData picks up app node as side effect but does not replace Channel A', async () => {
    const fakeJson = {
      version: '8.8.8',
      data: { y: { name: 'Y', category: '室内设计规范', subCategory: '餐饮工装', icon: 'y', description: '', sections: [] } },
      app: { latestVersion: '7.0.0', downloadUrl: 'https://x.com/app' },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => fakeJson }))

    await refreshSpecsData()

    // Both data AND app are updated (side effect)
    expect(getSpecsVersion()).toBe('8.8.8')
    expect(getAppInfo().latestVersion).toBe('7.0.0')
  })
})

describe('initSpecs orchestrator (Channel C — startup)', () => {
  it('calls onUpdate with builtin first, then remote result', async () => {
    const fakeJson = {
      version: '5.0.0',
      data: { z: { name: 'Z', category: '室内设计规范', subCategory: '餐饮工装', icon: 'z', description: '', sections: [] } },
      app: { latestVersion: '6.0.0' },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => fakeJson }))

    const updates = []
    const appInfos = []
    await initSpecs({ onUpdate: (u) => updates.push(u), onAppInfo: (a) => appInfos.push(a) })

    // At least builtin + remote update
    expect(updates.length).toBeGreaterThanOrEqual(2)
    expect(updates[0].source).toBe('builtin')
    expect(updates[updates.length - 1].source).toContain('spec.json')

    // App info called at least twice (builtin + remote)
    expect(appInfos.length).toBeGreaterThanOrEqual(2)
    // Last appInfo should have the new format: { app, source, error }
    const lastAppInfo = appInfos[appInfos.length - 1]
    expect(lastAppInfo.app.latestVersion).toBe('6.0.0')
  })

  it('surfaces bundled app info even when offline (graceful degradation)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const appInfos = []
    await initSpecs({ onAppInfo: (a) => appInfos.push(a) })

    // Must have at least one callback with bundled app info
    const bundledCall = appInfos.find((a) => a.app && a.app.latestVersion === '2.10.1')
    expect(bundledCall).toBeDefined()
  })
})
