/**
 * File I/O utilities: .moodboard serialization, localStorage auto-save.
 */

const AUTOSAVE_KEY = 'moodboard_autosave'
const MAX_AUTOSAVE_AGE = 30 * 24 * 3600 * 1000 // 30 days

/**
 * Version migration map for .moodboard project files.
 * Add migration functions here when the data structure changes.
 * Each function receives the raw project object and returns the
 * migrated project object at the target version.
 */
const MIGRATIONS = {
  // v1.0 (original): used 'height_val' field, no version field
  '1.0': (project) => {
    if (project.cards) {
      project.cards = project.cards.map((c) => {
        const restored = { ...c }
        delete restored.height_val
        return restored
      })
    }
    project.version = '2.0'
    return project
  },
  // v2.0 (current): clean state with no migration needed
  '2.0': (project) => project,
}

/**
 * Resolve a project version and apply all needed migrations.
 * @param {object} project - Raw parsed project object
 * @returns {object} Migrated project at the latest version
 */
function applyMigrations(project) {
  const rawVersion = project.version || '1.0'
  
  // If already at latest version, no migration needed
  if (rawVersion === '2.0') return project

  // Find the migration for this version
  const migrate = MIGRATIONS[rawVersion]
  if (!migrate) {
    // Unknown version — try v1.0 migration as fallback
    return MIGRATIONS['1.0'](project)
  }

  return migrate(project)
}

/**
 * Convert an image URL to base64 data URI (for embedding in save files).
 * Already-data-URIs are returned as-is.
 * Blob URLs are converted via fetch+FileReader (reliable in Electron).
 * HTTP/file URLs are converted via <img> → canvas (with CORS handling).
 * @param {string} url
 * @returns {Promise<string|null>}
 */
export async function imageUrlToBase64(url) {
  if (url.startsWith('data:')) return url

  // Blob URLs: use fetch + FileReader — most reliable in Electron
  if (url.startsWith('blob:')) {
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      return new Promise((resolve) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result)
        fr.onerror = () => resolve(null)
        fr.readAsDataURL(blob)
      })
    } catch {
      // Fall through to canvas path
    }
  }

  // Fallback: <img> → canvas for http/https/file URLs
  return new Promise((resolve) => {
    const img = new Image()
    // Only set crossOrigin for non-blob URLs (avoids issues with blob URLs)
    if (!url.startsWith('blob:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      try { resolve(c.toDataURL('image/jpeg', 0.85)) }
      catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/**
 * Serialize the project state into a .moodboard JSON blob.
 * Image URLs are converted to base64 data URIs.
 * @param {Array} cards
 * @param {object} canvas
 * @param {Array} customSpecs
 * @returns {Promise<Blob>}
 */
export async function serializeProject(cards, canvas, customSpecs) {
  const serializedCards = []
  for (const card of cards) {
    const c = { ...card }
    if (c.type === 'image' && c.imageUrl && !c.imageUrl.startsWith('data:')) {
      const base64 = await imageUrlToBase64(c.imageUrl)
      if (base64) {
        c.imageData = base64
      }
    }
    serializedCards.push(c)
  }

  const project = {
    version: '2.0',
    app: 'moodboard-app',
    timestamp: Date.now(),
    canvas,
    cards: serializedCards,
    customSpecs,
  }

  return new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
}

/**
 * Deserialize a .moodboard JSON string back into project state.
 * Restores imageData → imageUrl and cleans up internal fields.
 * @param {string} jsonStr
 * @returns {{ cards: Array, canvas: object, customSpecs: Array }|null}
 */
export function deserializeProject(jsonStr) {
  const project = JSON.parse(jsonStr)
  if (!project.cards || !Array.isArray(project.cards)) return null

  // Apply version migrations (v2.7.8+)
  const migrated = applyMigrations(project)

  const cards = migrated.cards.map(c => {
    const restored = { ...c }
    if (restored.imageData) {
      restored.imageUrl = restored.imageData
      delete restored.imageData
    }
    // Remove stale internal fields
    delete restored.height_val
    return restored
  })

  return {
    cards,
    canvas: migrated.canvas || { scale: 1, offsetX: 0, offsetY: 0 },
    customSpecs: migrated.customSpecs || [],
  }
}

/**
 * Save auto-save state to localStorage.
 * @param {{ cards: Array, canvas: object, customSpecs: Array }} state
 */
export function saveAutoSave(state) {
  try {
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ ...state, timestamp: Date.now() })
    )
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

// ─── Settings persistence ─────────────────────────────────────

const SETTINGS_KEY = 'moodboard_settings'
const RECENT_FILES_KEY = 'moodboard_recent_files'

/**
 * Read user settings from localStorage.
 * @returns {object|null} parsed settings or null
 */
export function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Write user settings to localStorage.
 * @param {object} settings
 */
export function writeSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Read recent files list from localStorage.
 * @returns {Array|null} parsed array or null
 */
export function readRecentFiles() {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Write recent files list to localStorage.
 * @param {Array} recentFiles
 */
export function writeRecentFiles(recentFiles) {
  try {
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Load auto-save state from localStorage.
 * Returns null if expired or unavailable.
 * @returns {{ cards: Array, canvas: object, customSpecs: Array }|null}
 */
export function loadAutoSave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw)
    const age = Date.now() - (state.timestamp || 0)
    if (age > MAX_AUTOSAVE_AGE) {
      localStorage.removeItem(AUTOSAVE_KEY)
      return null
    }
    return state
  } catch {
    return null
  }
}
