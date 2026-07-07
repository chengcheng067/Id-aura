/**
 * contextIsolation data injection fix — comprehensive test suite.
 *
 * v2.7.4 fix: Under contextIsolation: true, preload's window is isolated
 * from the renderer's window. The fix routes all .moodboard data through
 * contextBridge.exposeInMainWorld (startup) and executeJavaScript (runtime).
 *
 * Tests cover:
 *   1. findMoodboardPath (main.js helper) — argv parsing logic
 *   2. Preload injection IIFE — sync IPC + closure pattern
 *   3. App.jsx startup effect — electronAPI.getInjectedMoodboard() flow
 *   4. __loadMoodboardContent__ bridge — runtime file-open handler
 *   5. basename helper — path extraction
 */
import { describe, it, expect } from 'vitest'

// ═══════════════════════════════════════════════════════════════
// Helper: findMoodboardPath (extracted from main.js)
// ═══════════════════════════════════════════════════════════════

/**
 * Find a .moodboard path in an argv-like array.
 * Mirrors the exact logic from electron/main.js for testability.
 */
function findMoodboardPath(args) {
  if (!Array.isArray(args)) return null
  for (const raw of args) {
    const arg = (raw || '').replace(/^["']|["']$/g, '')
    if (arg.endsWith('.moodboard') && arg.length > '.moodboard'.length) {
      return arg
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// Helper: basename (extracted from App.jsx)
// ═══════════════════════════════════════════════════════════════

function basename(filePath) {
  return filePath.replace(/^.*[\\/]/, '')
}

// ═══════════════════════════════════════════════════════════════
// Mock preload IIFE pattern (simulates preload.js behaviour)
// ═══════════════════════════════════════════════════════════════

/**
 * Simulates the preload.js injection flow:
 *   IIFE calls sync IPC → captures value in closure →
 *   contextBridge.exposeInMainWorld exposes getter
 */
function simulatePreloadInjection(mockSendSyncReturn) {
  // Simulate ipcRenderer.sendSync('get-injected-moodboard')
  const ___injectedMoodboard = (() => {
    try {
      return mockSendSyncReturn
    } catch (_) {
      return null
    }
  })()

  // Simulate contextBridge.exposeInMainWorld
  const electronAPI = {
    isElectron: true,
    getInjectedMoodboard: () => ___injectedMoodboard,
  }

  return electronAPI
}

// ═══════════════════════════════════════════════════════════════
// Mock startup flow logic (extracted from App.jsx useEffect)
// ═══════════════════════════════════════════════════════════════

/**
 * Simulates the startup flow that reads injected content from electronAPI.
 * Returns { action, file } where action is one of:
 *   'injected'  — loaded from preload injection
 *   'welcome'   — show welcome page
 *   'last'      — init from auto-save
 *   'new'       — empty canvas
 */
function simulateStartupFlow(electronAPI, settings) {
  const injected = electronAPI?.getInjectedMoodboard?.()

  if (injected?.content) {
    return {
      action: 'injected',
      content: injected.content,
      filePath: injected.filePath,
    }
  }

  const { startupBehavior } = settings.file
  const { skipWelcome } = settings.display

  if (startupBehavior === 'welcome' && !skipWelcome) {
    return { action: 'welcome' }
  } else if (startupBehavior === 'last') {
    return { action: 'last' }
  } else {
    return { action: 'new' }
  }
}

// ═══════════════════════════════════════════════════════════════
// Mock __loadMoodboardContent__ bridge (App.jsx Electron bridge)
// ═══════════════════════════════════════════════════════════════

/**
 * Simulates window.__loadMoodboardContent__ as defined in App.jsx's
 * Electron bridge useEffect. Called by main.js via executeJavaScript.
 */
function createLoadMoodboardContent(loadProjectFn) {
  return function __loadMoodboardContent__(content, filePath) {
    if (!content) return null
    const fileName = filePath ? basename(filePath) : 'project.moodboard'
    return loadProjectFn(content, fileName, filePath)
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTS: findMoodboardPath
// ═══════════════════════════════════════════════════════════════

describe('findMoodboardPath (main.js argv parsing)', () => {
  it('should find a plain .moodboard path in argv', () => {
    const args = ['C:\\Program Files\\ID Aura\\ID Aura.exe', 'C:\\Users\\test\\project.moodboard']
    expect(findMoodboardPath(args)).toBe('C:\\Users\\test\\project.moodboard')
  })

  it('should handle quoted paths (double quotes)', () => {
    const args = ['exe', '"C:\\Users\\test\\project.moodboard"']
    expect(findMoodboardPath(args)).toBe('C:\\Users\\test\\project.moodboard')
  })

  it('should handle quoted paths (single quotes)', () => {
    const args = ['exe', "'/Users/test/project.moodboard'"]
    expect(findMoodboardPath(args)).toBe('/Users/test/project.moodboard')
  })

  it('should handle macOS paths', () => {
    const args = ['/Applications/ID Aura.app/Contents/MacOS/ID Aura', '/Users/test/project.moodboard']
    expect(findMoodboardPath(args)).toBe('/Users/test/project.moodboard')
  })

  it('should return null when no .moodboard in args', () => {
    const args = ['exe', '--help', '--version']
    expect(findMoodboardPath(args)).toBeNull()
  })

  it('should return null for empty args', () => {
    expect(findMoodboardPath([])).toBeNull()
  })

  it('should return null for non-array input', () => {
    expect(findMoodboardPath(null)).toBeNull()
    expect(findMoodboardPath(undefined)).toBeNull()
    expect(findMoodboardPath('string')).toBeNull()
  })

  it('should reject bare ".moodboard" (no filename)', () => {
    const args = ['exe', '.moodboard']
    expect(findMoodboardPath(args)).toBeNull()
  })

  it('should handle empty-string entries gracefully', () => {
    const args = ['exe', '', 'project.moodboard']
    expect(findMoodboardPath(args)).toBe('project.moodboard')
  })

  it('should handle paths with spaces', () => {
    const args = ['exe', 'C:\\Users\\test\\my project.moodboard']
    expect(findMoodboardPath(args)).toBe('C:\\Users\\test\\my project.moodboard')
  })

  it('should handle argv with second-instance commandLine format', () => {
    // Windows second-instance sends commandLine array
    const args = ['--allow-file-access-from-files', 'C:\\data\\design.moodboard']
    expect(findMoodboardPath(args)).toBe('C:\\data\\design.moodboard')
  })
})

// ═══════════════════════════════════════════════════════════════
// TESTS: basename
// ═══════════════════════════════════════════════════════════════

describe('basename (App.jsx path extraction)', () => {
  it('should extract filename from Windows path', () => {
    expect(basename('C:\\Users\\test\\project.moodboard')).toBe('project.moodboard')
  })

  it('should extract filename from Unix path', () => {
    expect(basename('/Users/test/project.moodboard')).toBe('project.moodboard')
  })

  it('should extract filename from mixed path', () => {
    expect(basename('C:\\Users\\test\\Documents\\my design.moodboard')).toBe('my design.moodboard')
  })

  it('should return input when no path separator', () => {
    expect(basename('project.moodboard')).toBe('project.moodboard')
  })

  it('should handle trailing slash gracefully', () => {
    expect(basename('/path/to/project.moodboard/')).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════
// TESTS: Preload injection IIFE (simulates preload.js)
// ═══════════════════════════════════════════════════════════════

describe('preload.js injection IIFE (contextBridge pattern)', () => {
  it('should expose getInjectedMoodboard via electronAPI', () => {
    const api = simulatePreloadInjection(null)
    expect(api).toHaveProperty('getInjectedMoodboard')
    expect(api.isElectron).toBe(true)
    expect(typeof api.getInjectedMoodboard).toBe('function')
  })

  it('should return injected content when present', () => {
    const injected = { content: '{"cards":[]}', filePath: '/test/project.moodboard' }
    const api = simulatePreloadInjection(injected)
    const result = api.getInjectedMoodboard()
    expect(result).toEqual(injected)
    expect(result.content).toBe('{"cards":[]}')
    expect(result.filePath).toBe('/test/project.moodboard')
  })

  it('should return null when no file was injected', () => {
    const api = simulatePreloadInjection(null)
    const result = api.getInjectedMoodboard()
    expect(result).toBeNull()
  })

  it('should handle undefined injection gracefully', () => {
    const api = simulatePreloadInjection(undefined)
    const result = api.getInjectedMoodboard()
    expect(result).toBeUndefined()
  })

  it('should preserve isElectron flag alongside getInjectedMoodboard', () => {
    const api = simulatePreloadInjection({ content: 'data' })
    expect(api.isElectron).toBe(true)
    expect(api.getInjectedMoodboard()).toEqual({ content: 'data' })
  })

  it('should capture value at IIFE execution time (closure behaviour)', () => {
    // The closure captures the value at IIFE execution time.
    // Even if the original variable changes later, the closure preserves it.
    const api = simulatePreloadInjection({ content: 'captured', filePath: '/a.moodboard' })
    const first = api.getInjectedMoodboard()
    const second = api.getInjectedMoodboard()
    // Multiple calls should return the same captured value
    expect(first).toEqual(second)
    expect(first.content).toBe('captured')
  })

  it('should handle large file content (stress test)', () => {
    const largeContent = JSON.stringify({ cards: Array(2000).fill({ id: 'x', type: 'image' }) })
    const api = simulatePreloadInjection({ content: largeContent, filePath: '/big.moodboard' })
    const result = api.getInjectedMoodboard()
    expect(result.content).toBe(largeContent)
    expect(result.content.length).toBeGreaterThan(50000)
  })
})

// ═══════════════════════════════════════════════════════════════
// TESTS: Startup flow (simulates App.jsx useEffect)
// ═══════════════════════════════════════════════════════════════

describe('App.jsx startup flow (electronAPI.getInjectedMoodboard)', () => {
  const defaultSettings = {
    file: { startupBehavior: 'new' },
    display: { skipWelcome: false },
  }

  // ── Scenario A: 首次启动 (双击 .moodboard 文件) ──
  it('Scenario A: should load injected content on first launch (double-click .moodboard)', () => {
    const api = simulatePreloadInjection({
      content: '{"cards":[{"id":"1"}]}',
      filePath: '/Users/test/design.moodboard',
    })
    const result = simulateStartupFlow(api, defaultSettings)
    expect(result.action).toBe('injected')
    expect(result.content).toBe('{"cards":[{"id":"1"}]}')
    expect(result.filePath).toBe('/Users/test/design.moodboard')
  })

  // ── Scenario D: 无文件启动 ──
  it('Scenario D: should show welcome page when no file injected and startup=welcome', () => {
    const api = simulatePreloadInjection(null)
    const settings = {
      file: { startupBehavior: 'welcome' },
      display: { skipWelcome: false },
    }
    const result = simulateStartupFlow(api, settings)
    expect(result.action).toBe('welcome')
  })

  it('Scenario D: should init from auto-save when startup=last (no file injected)', () => {
    const api = simulatePreloadInjection(null)
    const settings = {
      file: { startupBehavior: 'last' },
      display: {},
    }
    const result = simulateStartupFlow(api, settings)
    expect(result.action).toBe('last')
  })

  it('Scenario D: should show empty canvas when startup=new (no file injected)', () => {
    const api = simulatePreloadInjection(null)
    const settings = {
      file: { startupBehavior: 'new' },
      display: {},
    }
    const result = simulateStartupFlow(api, settings)
    expect(result.action).toBe('new')
  })

  it('should skip welcome page when skipWelcome is true', () => {
    const api = simulatePreloadInjection(null)
    const settings = {
      file: { startupBehavior: 'welcome' },
      display: { skipWelcome: true },
    }
    const result = simulateStartupFlow(api, settings)
    expect(result.action).toBe('new') // falls through to default 'new'
  })

  it('should handle missing electronAPI gracefully (browser dev mode)', () => {
    const result = simulateStartupFlow(undefined, defaultSettings)
    expect(result.action).toBe('new')
  })

  it('should handle electronAPI without getInjectedMoodboard gracefully', () => {
    const result = simulateStartupFlow({ isElectron: true }, defaultSettings)
    expect(result.action).toBe('new')
  })

  it('should handle injected object without content', () => {
    const api = simulatePreloadInjection({ filePath: '/test.moodboard' })
    const result = simulateStartupFlow(api, defaultSettings)
    // No content field → falls through to normal startup
    expect(result.action).toBe('new')
  })

  it('should handle injected with empty content string', () => {
    const api = simulatePreloadInjection({ content: '', filePath: '/test.moodboard' })
    const result = simulateStartupFlow(api, defaultSettings)
    // Empty string is falsy → falls through
    expect(result.action).toBe('new')
  })
})

// ═══════════════════════════════════════════════════════════════
// TESTS: __loadMoodboardContent__ bridge (App.jsx Electron bridge)
// ═══════════════════════════════════════════════════════════════

describe('__loadMoodboardContent__ bridge (executeJavaScript handler)', () => {
  it('Scenario B+C: should call loadProject with extracted content and path', () => {
    const calls = []
    const loadProject = (content, fileName, filePath) => {
      calls.push({ content, fileName, filePath })
    }
    const handler = createLoadMoodboardContent(loadProject)

    handler('{"cards":[]}', '/Users/test/project.moodboard')
    expect(calls).toHaveLength(1)
    expect(calls[0].content).toBe('{"cards":[]}')
    expect(calls[0].fileName).toBe('project.moodboard')
    expect(calls[0].filePath).toBe('/Users/test/project.moodboard')
  })

  it('should return null when content is empty', () => {
    const loadProject = () => { throw new Error('should not be called') }
    const handler = createLoadMoodboardContent(loadProject)
    expect(handler('', '/path/file.moodboard')).toBeNull()
    expect(handler(null, '/path/file.moodboard')).toBeNull()
    expect(handler(undefined, '/path/file.moodboard')).toBeNull()
  })

  it('should use default fileName when filePath is missing', () => {
    const calls = []
    const handler = createLoadMoodboardContent((content, fileName, filePath) => calls.push({ content, fileName, filePath }))
    handler('data', null)
    expect(calls[0].fileName).toBe('project.moodboard')
    expect(calls[0].filePath).toBeNull()
  })

  it('should handle Windows-style paths in fileName extraction', () => {
    const calls = []
    const handler = createLoadMoodboardContent((content, fileName, filePath) => calls.push({ content, fileName, filePath }))
    handler('data', 'C:\\Users\\test\\Documents\\my design.moodboard')
    expect(calls[0].fileName).toBe('my design.moodboard')
  })

  it('should handle macOS paths in fileName extraction', () => {
    const calls = []
    const handler = createLoadMoodboardContent((content, fileName, filePath) => calls.push({ content, fileName, filePath }))
    handler('data', '/Users/test/Designs/project.moodboard')
    expect(calls[0].fileName).toBe('project.moodboard')
  })
})

// ═══════════════════════════════════════════════════════════════
// TESTS: Integration — full data-flow chain
// ═══════════════════════════════════════════════════════════════

describe('Full data-flow integration (main → preload → contextBridge → React)', () => {
  it('should pass data from preload injection through to startup flow', () => {
    // Step 1: main process reads file → injectedMoodboard = {content, filePath}
    const mainInjected = { content: '{"cards":[{"id":"abc"}]}', filePath: '/data/test.moodboard' }

    // Step 2: preload.js IIFE calls sendSync → captures value
    const api = simulatePreloadInjection(mainInjected)

    // Step 3: contextBridge exposes electronAPI.getInjectedMoodboard()
    const injected = api.getInjectedMoodboard()
    expect(injected).toEqual(mainInjected)

    // Step 4: App.jsx startup useEffect reads via electronAPI
    const result = simulateStartupFlow(api, { file: { startupBehavior: 'new' }, display: {} })
    expect(result.action).toBe('injected')
    expect(result.content).toBe('{"cards":[{"id":"abc"}]}')
    expect(result.filePath).toBe('/data/test.moodboard')
  })

  it('should handle null injection end-to-end (no file scenario)', () => {
    const api = simulatePreloadInjection(null)
    const injected = api.getInjectedMoodboard()
    expect(injected).toBeNull()
    const result = simulateStartupFlow(api, { file: { startupBehavior: 'welcome' }, display: { skipWelcome: false } })
    expect(result.action).toBe('welcome')
  })
})
