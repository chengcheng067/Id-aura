import { readSettings, writeSettings, readRecentFiles, writeRecentFiles } from '../utils/fileIO'
import { initSpecs, checkAppUpdate, refreshSpecsData, getSpecsVersion, compareVersion, getAppInfo } from '../data/specs'
import packageJson from '../../package.json'

// Current running app version (from package.json). Used to decide whether
// a remotely-published version (spec.json "app" node) is "newer".
const CURRENT_APP_VERSION = packageJson.version

const MAX_RECENT_FILES = 10

/** Default settings — used as fallback and for reset. */
const DEFAULT_SETTINGS = {
  canvas: {
    pattern: 'dots',
    dotSize: 1.5,
    dotSpacing: 25,
    lineWidth: 1,
    gridSpacing: 30,
    bgOpacity: 0.06,
    bgColor: '#0d0d0d',
  },
  file: {
    autoSaveInterval: 30000,
    startupBehavior: 'welcome',
    confirmBeforeClose: true,
  },
  display: {
    language: 'zh-CN',
    skipWelcome: false,
  },
  shortcuts: {},
  ai: {
    apiEndpoint: 'https://api.openai.com/v1',
    apiKey: '',
    modelName: 'gpt-4o-mini',
    mode: 'quick',
    lastTested: null,
  },
  toolbar: {
    visible: [
      'alwaysOnTop',
      'undo',
      'redo',
      'panel',
      'addImage',
      'urlImport',
      'note',
      'label',
      'paste',
      'draw',
      'save',
      'open',
      'export',
      'clear',
      'settings',
      'cardCount',
    ],
  },
  spec: {
    // Remote spec source. jsDelivr (GitHub CDN) is preferred; GitHub raw is the
    // automatic fallback inside initSpecs(). User can point this anywhere.
    source: 'https://cdn.jsdelivr.net/gh/chengcheng067/Id-aura@main/spec.json',
  },
}

/**
 * Deep-merge default settings into loaded partial to handle missing keys
 * added in newer versions.
 */
function mergeDefaults(loaded) {
  const merged = { ...DEFAULT_SETTINGS }
  if (!loaded) return merged

  for (const section of Object.keys(DEFAULT_SETTINGS)) {
    if (loaded[section] && typeof loaded[section] === 'object') {
      merged[section] = { ...DEFAULT_SETTINGS[section], ...loaded[section] }
    }
  }
  return merged
}

/**
 * Settings slice: persistent user preferences + recent files list.
 *
 * API Key Security (v2.7.8):
 *   - API key is stored encrypted in localStorage via Electron safeStorage.
 *   - On load: if key starts with 'enc:', it's decrypted asynchronously
 *     and the decrypted value replaces the encrypted one in memory.
 *   - On save: the key is encrypted before writing to localStorage.
 *   - In memory, the key is always plaintext (for use by aiClient).
 *
 * Architecture:
 *   - settings: structured config (canvas, file, display, shortcuts)
 *   - recentFiles: array of { name, path, thumbnail, lastModified, cardCount }
 *   - loadSettings/saveSettings: localStorage round-trip with merge
 *   - update*Settings: partial merges that auto-save
 *   - addRecentFile: push to head, deduplicate by path, max 10
 *   - generateThumbnail: async Canvas API screenshot → base64 JPEG
 */
export const createSettingsSlice = (set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  recentFiles: [],

  // ─── Spec data runtime state (P0 规范库外置化) ──────────
  // specVersion is bumped on every spec load (success or fail); UI
  // (SidePanel) depends on it so it re-computes the category tree.
  specVersion: 0,
  specStatus: { version: getSpecsVersion(), source: 'builtin', categories: 0 },
  specError: null,   // { message, timestamp } | null — last refresh error

  // ─── App self-update (reuses the spec GitHub channel) ──────
  // `info` is the remote spec.json "app" node; `available` means a
  // newer app version exists and the user hasn't ignored it.
  appUpdate: { available: false, info: null, checked: false, skippedVersion: null },

  // ─── Persistence ───────────────────────────────────────────

  /**
   * Load settings from localStorage, merging with defaults so newly
   * added keys are never missing. Also loads recent files list.
   * API key will be decrypted later via decryptStoredApiKey().
   */
  loadSettings: () => {
    const saved = readSettings()
    const merged = mergeDefaults(saved)
    const recent = readRecentFiles() || []
    set({ settings: merged, recentFiles: recent })
  },

  /**
   * After loadSettings(), decrypt the API key if it was stored encrypted.
   * Called once during app startup from App.jsx.
   * This is async because safeStorage decryption requires IPC.
   */
  decryptStoredApiKey: async () => {
    const state = get()
    const key = state.settings.ai.apiKey
    if (!key || !key.startsWith('enc:')) return // not encrypted, nothing to do

    if (!window.electronAPI?.decryptString) return // not in Electron

    const result = await window.electronAPI.decryptString(key.slice(4))
    if (result.success) {
      set((state) => ({
        settings: {
          ...state.settings,
          ai: { ...state.settings.ai, apiKey: result.data },
        },
      }))
    }
    // If decryption fails, keep the encrypted key as-is (user can re-enter)
  },

  /**
   * Persist current settings to localStorage.
   * The API key is encrypted before writing if safeStorage is available.
   */
  saveSettings: async () => {
    const { settings, recentFiles } = get()
    const key = settings.ai.apiKey
    let keyToStore = key

    // Encrypt the API key before writing to localStorage
    if (key && window.electronAPI?.encryptString && window.electronAPI?.isEncryptionAvailable) {
      const avail = await window.electronAPI.isEncryptionAvailable()
      if (avail) {
        const result = await window.electronAPI.encryptString(key)
        if (result.success) {
          keyToStore = 'enc:' + result.data
        }
      }
    }

    // Write with the (possibly encrypted) key
    const settingsToWrite = {
      ...settings,
      ai: { ...settings.ai, apiKey: keyToStore },
    }
    writeSettings(settingsToWrite)
    writeRecentFiles(recentFiles)

    // Restore the plaintext key in memory (the write above used encrypted)
    if (keyToStore !== key) {
      set((state) => ({
        settings: {
          ...state.settings,
          ai: { ...state.settings.ai, apiKey: key },
        },
      }))
    }
  },

  // ─── Section updaters (partial merge + auto-save) ──────────

  /** Update canvas-related settings with a partial object. */
  updateCanvasSettings: (partial) => {
    set((state) => {
      const canvas = { ...state.settings.canvas, ...partial }
      const next = { ...state.settings, canvas }
      return { settings: next }
    })
    get().saveSettings()
  },

  /** Update file-related settings with a partial object. */
  updateFileSettings: (partial) => {
    set((state) => {
      const file = { ...state.settings.file, ...partial }
      const next = { ...state.settings, file }
      return { settings: next }
    })
    get().saveSettings()
  },

  /** Update display-related settings with a partial object. */
  updateDisplaySettings: (partial) => {
    set((state) => {
      const display = { ...state.settings.display, ...partial }
      const next = { ...state.settings, display }
      return { settings: next }
    })
    get().saveSettings()
  },

  /** Update AI-related settings with a partial object. */
  updateAiSettings: (partial) => {
    set((state) => {
      const ai = { ...state.settings.ai, ...partial }
      const next = { ...state.settings, ai }
      return { settings: next }
    })
    get().saveSettings()
  },

  /** Update toolbar visibility settings with a partial object. */
  updateToolbarSettings: (partial) => {
    set((state) => {
      const toolbar = { ...state.settings.toolbar, ...partial }
      const next = { ...state.settings, toolbar }
      return { settings: next }
    })
    get().saveSettings()
  },

  /** Reset all settings to factory defaults. */
  resetAllSettings: () => {
    const defaults = { ...DEFAULT_SETTINGS }
    set({ settings: defaults, recentFiles: [] })
    writeRecentFiles([])
    get().saveSettings()
  },

  // ─── Spec source (P0 规范库外置化) ───────────────────────

  /** Update the remote spec source URL and persist. */
  updateSpecSource: (url) => {
    set((state) => ({
      settings: { ...state.settings, spec: { ...state.settings.spec, source: url } },
    }))
    get().saveSettings()
  },

  // ═══ Channel A: App version check (lightweight) ═══
  // Only touches appUpdate state. Does NOT reload spec data.
  // Can be called independently from About tab "检查更新".
  /**
   * Check for a newer app version by fetching the remote "app" node.
   * Safe to call repeatedly; only modifies appUpdate state.
   */
  checkForAppUpdate: async () => {
    const src = get().settings.spec.source
    const result = await checkAppUpdate({ specSource: src })
    // result is { app, source, error }
    if (!result.app || !result.app.latestVersion) {
      set({ appUpdate: { available: false, info: null, checked: true, skippedVersion: get().appUpdate.skippedVersion } })
      return result
    }
    const cmp = compareVersion(result.app.latestVersion, CURRENT_APP_VERSION)
    const skipped = get().appUpdate.skippedVersion === result.app.latestVersion
    set({
      appUpdate: {
        available: cmp > 0 && !skipped,
        info: result.app,
        checked: true,
        skippedVersion: skipped ? result.app.latestVersion : get().appUpdate.skippedVersion,
      },
    })
    return result
  },

  // ═══ Channel B: Specs data refresh (full reload) ═══
  // Only touches specVersion / specStatus / specError state.
  // Can be called independently from Spec tab "立即检查更新".
  /**
   * Re-fetch specs data from remote. Overwrites local library when
   * remote is reachable (SOURCE OF TRUTH). Always updates status/error
   * so the UI can show what happened.
   */
  refreshSpecsDataAction: async () => {
    const src = get().settings.spec.source
    const result = await refreshSpecsData({ specSource: src })
    // result is { success, version, source, categories, error }
    set((state) => ({
      specVersion: state.specVersion + 1,
      specStatus: {
        version: result.version,
        source: result.source,
        categories: result.categories,
      },
      specError: result.error
        ? { message: result.error, timestamp: Date.now() }
        : null,
    }))
    return result
  },

  // ═══ Channel C: Startup orchestrator (backward compatible) ═══
  // Called by App.jsx on launch. Runs both channels in parallel.
  /**
   * Full startup refresh — runs both app-version check and specs-data
   * reload. This is what App.jsx calls on launch; individual tabs can
   * call checkForAppUpdate / refreshSpecsDataAction independently.
   */
  refreshSpecs: async () => {
    // Run both channels in parallel (they're independent)
    await Promise.all([
      get().checkForAppUpdate(),
      get().refreshSpecsDataAction(),
    ])
  },

  /**
   * Dismiss the update prompt for this session (without forgetting the version).
   * The prompt will re-appear next launch unless the version is skipped.
   */
  dismissAppUpdate: () => set((state) => ({ appUpdate: { ...state.appUpdate, available: false } })),

  /**
   * Permanently ignore a specific version (won't prompt again until a
   * newer version is published).
   * @param {string} version
   */
  skipAppVersion: (version) => set((state) => ({
    appUpdate: { ...state.appUpdate, available: false, skippedVersion: version },
  })),

  // ─── Recent files ──────────────────────────────────────────

  /**
   * Add a file entry to the recent files list.
   * Pushes to head, deduplicates by path, caps at MAX_RECENT_FILES.
   * @param {{ name: string, path: string|null, thumbnail: string|null, lastModified: number, cardCount: number }} file
   */
  addRecentFile: (file) => {
    set((state) => {
      const filtered = state.recentFiles.filter((f) => {
        // Deduplicate: keep only entries with different path
        // If path is null (auto-save), keep only one null-path entry
        if (file.path === null && f.path === null) return false
        if (file.path !== null && f.path === file.path) return false
        return true
      })
      const next = [file, ...filtered].slice(0, MAX_RECENT_FILES)
      writeRecentFiles(next)
      return { recentFiles: next }
    })
  },

  /**
   * Remove a single recent file entry by path.
   * @param {string} path
   */
  removeRecentFile: (path) => {
    set((state) => {
      const next = state.recentFiles.filter((f) => f.path !== path)
      writeRecentFiles(next)
      return { recentFiles: next }
    })
  },

  /** Remove all recent file entries. */
  clearRecentFiles: () => {
    writeRecentFiles([])
    set({ recentFiles: [] })
  },

  // ─── Thumbnail generation ──────────────────────────────────

  /**
   * Capture the current canvas as a 280×180 JPEG thumbnail.
   * Uses html2canvas (already a dependency) for rendering.
   * @returns {Promise<string|null>} base64 data URL or null on failure
   */
  generateThumbnail: async () => {
    try {
      const canvasEl = document.querySelector('.moodboard-canvas')
      if (!canvasEl) return null

      const html2canvas = (await import('html2canvas')).default
      const fullDataUrl = await html2canvas(canvasEl, {
        backgroundColor: '#0d0d0d',
        scale: 0.5,
        useCORS: true,
        allowTaint: true,
      })

      // Downscale to 280×180
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const c = document.createElement('canvas')
          c.width = 280
          c.height = 180
          const ctx = c.getContext('2d')
          ctx.drawImage(img, 0, 0, 280, 180)
          resolve(c.toDataURL('image/jpeg', 0.6))
        }
        img.onerror = () => resolve(null)
        img.src = fullDataUrl
      })
    } catch {
      return null
    }
  },
})
