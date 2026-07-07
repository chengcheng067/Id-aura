/**
 * Unit tests for selection slice.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createSelectionSlice } from './selectionSlice'

function createMockStore() {
  let state = { selectedIds: [] }
  const set = (updater) => {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) }
    } else {
      state = { ...state, ...updater }
    }
  }
  const get = () => state
  const slice = createSelectionSlice(set, get)
  state = { ...state, ...slice }
  return { set, get, state, slice }
}

describe('selectionSlice — selectCard', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should select a single card (mode=single)', () => {
    store.slice.selectCard('a', 'single')
    expect(store.get().selectedIds).toEqual(['a'])
  })

  it('should replace selection on single mode', () => {
    store.slice.selectCard('a', 'single')
    store.slice.selectCard('b', 'single')
    expect(store.get().selectedIds).toEqual(['b'])
  })

  it('should toggle card selection', () => {
    store.slice.selectCard('a', 'single')
    store.slice.selectCard('b', 'toggle')
    expect(store.get().selectedIds).toEqual(['a', 'b'])
    store.slice.selectCard('a', 'toggle')
    expect(store.get().selectedIds).toEqual(['b'])
  })

  it('should add card (mode=add, no duplicate)', () => {
    store.slice.selectCard('a', 'single')
    store.slice.selectCard('b', 'add')
    store.slice.selectCard('b', 'add') // should not duplicate
    expect(store.get().selectedIds).toEqual(['a', 'b'])
  })

  it('should default to single mode', () => {
    store.slice.selectCard('x')
    expect(store.get().selectedIds).toEqual(['x'])
  })
})

describe('selectionSlice — selectCards', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should set selection', () => {
    store.slice.selectCards(['a', 'b', 'c'], 'set')
    expect(store.get().selectedIds).toEqual(['a', 'b', 'c'])
  })

  it('should box select (replace)', () => {
    store.slice.selectCards(['x', 'y'], 'box')
    expect(store.get().selectedIds).toEqual(['x', 'y'])
  })

  it('should clear selection', () => {
    store.slice.selectCards(['a', 'b'], 'set')
    store.slice.selectCards([], 'clear')
    expect(store.get().selectedIds).toEqual([])
  })
})

describe('selectionSlice — clearSelection / clearSelectionForIds', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should clear all selection', () => {
    store.slice.selectCards(['a', 'b', 'c'], 'set')
    store.slice.clearSelection()
    expect(store.get().selectedIds).toEqual([])
  })

  it('should clear selection for specific ids', () => {
    store.slice.selectCards(['a', 'b', 'c'], 'set')
    store.slice.clearSelectionForIds(['a', 'c'])
    expect(store.get().selectedIds).toEqual(['b'])
  })

  it('should accept a single id', () => {
    store.slice.selectCards(['a', 'b', 'c'], 'set')
    store.slice.clearSelectionForIds('b')
    expect(store.get().selectedIds).toEqual(['a', 'c'])
  })
})
