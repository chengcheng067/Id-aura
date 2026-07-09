/**
 * Spec data layer (P0 — 规范库外置化).
 *
 * Specs are NO LONGER baked into the module as a static object. Instead:
 *   - A built-in fallback (`specs.bundled.js`) ships inside the EXE and is
 *     loaded immediately on launch so the library is never empty.
 *   - On launch `initSpecs()` fetches a remote source (jsDelivr preferred,
 *     GitHub raw as fallback). If the remote version is newer it overrides
 *     the built-in data and is cached to userData for offline use.
 *   - If the network is unreachable we silently keep the built-in/cached data.
 *
 * All getter functions keep their original signatures so consumers
 * (SidePanel, AiPanel, FloatingAiButton) need no changes.
 */
import { specsData as BUNDLED_DATA, specsVersion as BUNDLED_VERSION } from './specs.bundled.js'

// ── Runtime data (replaced by remote/cache on init) ──────────────────────
let SPECS_DATA = BUNDLED_DATA
let SPECS_VERSION = BUNDLED_VERSION

export function setSpecsData(data, version) {
  if (!data || typeof data !== 'object') return false
  SPECS_DATA = data
  if (version) SPECS_VERSION = version
  return true
}

export function getSpecsVersion() {
  return SPECS_VERSION
}

// ── Version comparison (tolerant semver: "1.2.3") ─────────────────────────
function compareVersion(a, b) {
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

// ── Remote loading ────────────────────────────────────────────────────────
const DEFAULT_REMOTE = 'https://cdn.jsdelivr.net/gh/chengcheng067/Id-aura@main/spec.json'
const GITHUB_RAW = 'https://raw.githubusercontent.com/chengcheng067/Id-aura/main/spec.json'

async function fetchJson(url) {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

/**
 * Load specs:
 *   1) start from built-in fallback (already set)
 *   2) upgrade with the userData cache if newer
 *   3) upgrade with the remote source (custom → jsDelivr → GitHub raw)
 *
 * @param {Object} opts
 * @param {string} [opts.specSource] custom remote URL from settings
 * @param {(info:{version:string,source:string})=>void} [opts.onUpdate] called after data changes
 */
export async function initSpecs({ specSource, onUpdate } = {}) {
  // 1) built-in fallback is already active; notify once.
  onUpdate && onUpdate({ version: SPECS_VERSION, source: 'builtin' })

  // 2) userData cache (Electron only)
  try {
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.getSpecCache) {
      const cached = await window.electronAPI.getSpecCache()
      if (cached && cached.version && compareVersion(cached.version, SPECS_VERSION) > 0) {
        if (setSpecsData(cached.data, cached.version)) {
          onUpdate && onUpdate({ version: cached.version, source: 'cache' })
        }
      }
    }
  } catch (_) {
    /* ignore cache read errors */
  }

  // 3) remote chain
  const sources = []
  if (specSource && specSource.trim()) sources.push(specSource.trim())
  sources.push(DEFAULT_REMOTE)
  sources.push(GITHUB_RAW)
  // de-duplicate while preserving order
  const unique = [...new Set(sources)]

  for (const url of unique) {
    try {
      const json = await fetchJson(url)
      if (json && json.data && json.version) {
        if (compareVersion(json.version, SPECS_VERSION) > 0) {
          if (setSpecsData(json.data, json.version)) {
            onUpdate && onUpdate({ version: json.version, source: 'remote' })
            // persist for offline use
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.saveSpecCache) {
              window.electronAPI.saveSpecCache({ version: json.version, data: json.data })
            }
          }
        }
        break // a valid response means we don't need the fallbacks
      }
    } catch (_) {
      // try next source
    }
  }
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
