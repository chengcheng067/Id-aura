/**
 * Spec data layer (P0 — 规范库外置化) + App self-update check.
 *
 * ── Two independent channels (v2.10.0 refactor) ──────────────────
 *
 * Channel A — App version check (checkAppUpdate):
 *   Lightweight fetch that ONLY reads the remote "app" node to detect
 *   whether a newer EXE has been published. Does NOT touch spec data.
 *   Called at startup and from Settings → About "检查更新".
 *
 * Channel B — Specs data refresh (refreshSpecsData):
 *   Full remote fetch → overwrite local library (built-in or cached).
 *   The REMOTE IS THE SOURCE OF TRUTH: whenever reachable, its data wins.
 *   No version bump required — editing spec.json online takes effect on
 *   next launch. Persists to userData cache for offline use.
 *   Called at startup and from Settings → Spec "立即检查更新".
 *
 * Channel C — initSpecs (startup orchestrator):
 *   Calls both channels in parallel. Kept for backward compatibility;
 *   App.jsx still calls store.refreshSpecs() which delegates here.
 *
 * ── Data flow ────────────────────────────────────────────────────
 *   Built-in fallback (ships in EXE, loads immediately)
 *     → userData cache (Electron only, if newer)
 *       → Remote source (custom URL → jsDelivr → GitHub raw)
 *
 * ── Error visibility (v2.10.0) ───────────────────────────────────
 *   All functions now return structured results instead of silently
 *   swallowing errors. Callers get { success/error/version/source }
 *   so the UI can show "loaded v1.1.0 (64 categories)" or
 *   "network unreachable, using cached v1.0.0".
 */
import { specsData as BUNDLED_DATA, specsVersion as BUNDLED_VERSION, specsApp as BUNDLED_APP } from './specs.bundled.js'

// ── Runtime data (replaced by remote/cache on init) ──────────────────────
let SPECS_DATA = BUNDLED_DATA
let SPECS_VERSION = BUNDLED_VERSION
let SPECS_APP = BUNDLED_APP

export function setSpecsData(data, version) {
  if (!data || typeof data !== 'object') return false
  SPECS_DATA = data
  if (version) SPECS_VERSION = version
  return true
}

export function getSpecsVersion() {
  return SPECS_VERSION
}

// ── App update info (from remote spec.json "app" node, or bundled fallback) ──
export function getAppInfo() {
  return SPECS_APP
}

export function setAppInfo(app) {
  if (app && typeof app === 'object') {
    SPECS_APP = app
    return true
  }
  return false
}

// ── Version comparison (tolerant semver: "1.2.3") ─────────────────────────
export function compareVersion(a, b) {
  const pa = String(a).split('.')
  const pb = String(b).split('.')
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] || '0', 10) || 0
    const nb = parseInt(pb[i] || '0', 10) || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

// ── Remote loading infrastructure ────────────────────────────────────────
const DEFAULT_REMOTE = 'https://cdn.jsdelivr.net/gh/chengcheng067/Id-aura@main/spec.json'
const GITHUB_RAW = 'https://raw.githubusercontent.com/chengcheng067/Id-aura/main/spec.json'
const FETCH_TIMEOUT_MS = 15000

/**
 * Fetch JSON from a URL with timeout and CORS mode.
 * @returns {Promise<Object|null>} parsed JSON or null on failure
 */
async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  // Cache-bust: Electron/Chromium HTTP cache would otherwise serve a stale
  // spec.json (e.g. v1.0.0) even after the remote is updated to v1.1.0.
  // `no-store` bypasses the local cache; the timestamp query also defeats
  // any intermediate proxy cache. The displayed source URL stays clean.
  const busted = url.includes('?') ? `${url}&_=${Date.now()}` : `${url}?_=${Date.now()}`
  try {
    const res = await fetch(busted, { mode: 'cors', signal: controller.signal, cache: 'no-store' })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return await res.json()
  } catch (err) {
    // Return structured error info instead of swallowing
    return { _error: err.message || String(err), _url: url }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Build the ordered list of remote URLs to try.
 * @param {string} [specSource] custom URL from user settings
 * @returns {string[]}
 */
function buildSourceChain(specSource) {
  const sources = []
  if (specSource && specSource.trim()) sources.push(specSource.trim())
  sources.push(DEFAULT_REMOTE)
  sources.push(GITHUB_RAW)
  return [...new Set(sources)] // dedupe preserving order
}

// ════════════════════════════════════════════════════════════════════════════
// CHANNEL A — App version check (lightweight, does NOT touch spec data)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Check remotely-published app version via the spec.json "app" node.
 * This is a LIGHTWEIGHT check — it only reads the `app` field and never
 * modifies the spec data library (SPECS_DATA / SPECS_VERSION).
 *
 * @param {Object} opts
 * @param {string} [opts.specSource] custom remote URL
 * @returns {Promise<{app:Object|null, source:string|null, error:string|null}>}
 */
export async function checkAppUpdate({ specSource } = {}) {
  const urls = buildSourceChain(specSource)

  let lastError = null
  for (const url of urls) {
    const json = await fetchJson(url)
    // fetchJson returns {_error} object on failure
    if (json && json._error) {
      lastError = `[${url}] ${json._error}`
      continue
    }
    if (!json || !json.app || !json.app.latestVersion) {
      lastError = `[${url}] response missing app node`
      continue
    }

    // Valid app info found
    setAppInfo(json.app)
    return { app: json.app, source: url, error: null }
  }

  // All sources failed — bundled is the best we have
  return { app: SPECS_APP, source: 'builtin', error: lastError || 'no reachable source' }
}

// ════════════════════════════════════════════════════════════════════════════
// CHANNEL B — Specs data refresh (full data reload)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Fetch and apply remote specs data. Overwrites the local library whenever
 * the remote is reachable and carries category data. The REMOTE IS THE
 * SOURCE OF TRUTH — no version comparison gate; any valid data replaces
 * what we have. Result is persisted to userData cache for offline use.
 *
 * @param {Object} opts
 * @param {string} [opts.specSource] custom remote URL
 * @returns {Promise<{success:boolean, version:string, source:string, categories:number, error:string|null}>}
 */
export async function refreshSpecsData({ specSource } = {}) {
  const urls = buildSourceChain(specSource)

  let lastError = null
  for (const url of urls) {
    const json = await fetchJson(url)

    // fetchJson returns {_error} object on failure
    if (json && json._error) {
      lastError = `[${url}] ${json._error}`
      continue
    }

    if (!json) {
      lastError = `[${url}] empty response`
      continue
    }

    // Pick up app node when present (side effect, doesn't hurt)
    if (json.app && json.app.latestVersion) {
      setAppInfo(json.app)
    }

    // Validate data payload
    if (!json.data || typeof json.data !== 'object' || Object.keys(json.data).length === 0) {
      lastError = `[${url}] no usable category data`
      continue
    }

    // Apply remote data — SOURCE OF TRUTH
    const catCount = Object.keys(json.data).length
    setSpecsData(json.data, json.version)

    // Persist to userData cache for offline use
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.saveSpecCache) {
      try {
        window.electronAPI.saveSpecCache({ version: json.version, data: json.data })
      } catch (_) {
        /* non-fatal: cache write failure doesn't block the in-memory update */
      }
    }

    return {
      success: true,
      version: json.version,
      source: url,
      categories: catCount,
      error: null,
    }
  }

  // All sources failed — report the last error with current state
  return {
    success: false,
    version: SPECS_VERSION,
    source: 'builtin',
    categories: Object.keys(SPECS_DATA).length,
    error: lastError || '无法连接到任何数据源',
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CHANNEL C — Startup orchestrator (backward compatible)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Load specs on startup. Orchestrates both channels:
 *   1) Notifies caller of built-in state (instant UI render).
 *   2) Upgrades with userData cache if available (Electron only).
 *   3) Launches both remote checks:
 *      - Channel A (app version) → surfaced via onAppInfo callback
 *      - Channel B (specs data) → surfaced via onUpdate callback
 *
 * @param {Object} opts
 * @param {string} [opts.specSource]
 * @param {(info:{version:string,source:string,categories:number,error?:string})=>void} [opts.onUpdate]
 * @param {(result:{app:Object|null,source:string,error?:string})=>void} [opts.onAppInfo]
 */
export async function initSpecs({ specSource, onUpdate, onAppInfo } = {}) {
  // 1) Notify built-in state immediately so UI isn't blank
  onUpdate && onUpdate({
    version: SPECS_VERSION,
    source: 'builtin',
    categories: Object.keys(SPECS_DATA).length,
    error: null,
  })
  onAppInfo && onAppInfo({ app: SPECS_APP, source: 'builtin', error: null })

  // 2) userData cache (Electron only)
  try {
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.getSpecCache) {
      const cached = await window.electronAPI.getSpecCache()
      if (cached && cached.version && cached.data && Object.keys(cached.data).length > 0) {
        if (setSpecsData(cached.data, cached.version)) {
          onUpdate && onUpdate({
            version: cached.version,
            source: 'cache',
            categories: Object.keys(cached.data).length,
            error: null,
          })
        }
      }
    }
  } catch (_) {
    /* ignore cache read errors */
  }

  // 3) Run both remote channels
  // Channel A: app version check (fire-and-forget, notify via callback)
  checkAppUpdate({ specSource }).then((result) => {
    onAppInfo && onAppInfo(result)
  })

  // Channel B: specs data refresh (notify via callback)
  const dataResult = await refreshSpecsData({ specSource })
  onUpdate && onUpdate(dataResult)
}

// ── Getters (unchanged signatures) ────────────────────────────────────────
export function getPrimaryCategories() {
  return ['建筑设计规范', '室内设计规范', '景观设计规范']
}

export function getSpecsByPrimaryCategory(primary) {
  return Object.entries(SPECS_DATA).filter(([_, v]) => v.category === primary)
}

export function getSpecsBySubCategory(sub) {
  return Object.entries(SPECS_DATA).filter(([_, v]) => v.subCategory === sub)
}

export function getGroupedByPrimaryCategory() {
  const result = {}
  for (const [id, spec] of Object.entries(SPECS_DATA)) {
    const primary = spec.category
    const secondary = spec.subCategory
    if (!result[primary]) result[primary] = {}
    if (!result[primary][secondary]) result[primary][secondary] = []
    const itemCount = (spec.sections || []).reduce((sum, s) => sum + s.items.length, 0)
    result[primary][secondary].push({
      id,
      name: spec.name,
      icon: spec.icon,
      description: spec.description,
      itemCount,
    })
  }
  return result
}

export function getCategoryList() {
  return Object.entries(SPECS_DATA).map(([key, val]) => ({
    id: key,
    name: val.name,
    icon: val.icon,
    category: val.category,
    subCategory: val.subCategory,
    description: val.description,
  }))
}

export function getSpecByCategory(categoryId) {
  return SPECS_DATA[categoryId] || null
}

export function getAllSpecs() {
  return SPECS_DATA
}

export function searchSpecs(query) {
  const q = query.toLowerCase()
  const results = []
  for (const [id, cat] of Object.entries(SPECS_DATA)) {
    for (const section of cat.sections) {
      for (const item of section.items) {
        if (
          item.label.toLowerCase().includes(q) ||
          item.value.toLowerCase().includes(q) ||
          item.note.toLowerCase().includes(q)
        ) {
          results.push({
            categoryId: id,
            categoryName: cat.name,
            categoryIcon: cat.icon,
            sectionTitle: section.title,
            ...item,
          })
        }
      }
    }
  }
  return results
}
