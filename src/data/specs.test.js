import { describe, it, expect } from 'vitest'
import {
  getGroupedByPrimaryCategory,
  getSpecByCategory,
  searchSpecs,
  getAllSpecs,
  setSpecsData,
  getSpecsVersion,
} from './specs'

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
    // restore so other tests see the real data
    setSpecsData(original, before)
    expect(getSpecsVersion()).toBe(before)
  })
})
