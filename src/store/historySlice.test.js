/**
 * Unit tests for historySlice — undo/redo functionality.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createHistorySlice } from './historySlice'

function createMockStore() {
  let state = { cards: [], past: [], future: [], selectedIds: [] }
  const set = (updater) => {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) }
    } else {
      state = { ...state, ...updater }
    }
  }
  const get = () => state
  const slice = createHistorySlice(set, get)
  state = { ...state, ...slice }
  return { set, get, state, slice }
}

function makeCard(id, overrides = {}) {
  return {
    id, type: 'image', x: 100, y: 100, width: 200, height: 150,
    rotation: 0, zIndex: 0, locked: false, groupId: null,
    imageUrl: `data:image/png;base64,${id}`, name: 'test', flipH: false, flipV: false,
    note: '', sourceUrl: '', sourceType: '', ...overrides,
  }
}

describe('historySlice — _pushHistory', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should push current cards state onto past stack', () => {
    store.set({ cards: [makeCard('a'), makeCard('b')] })
    store.slice._pushHistory()
    expect(store.get().past).toHaveLength(1)
    expect(store.get().past[0]).toHaveLength(2)
  })

  it('should clear future stack on new push', () => {
    store.set({ future: [{ id: 'x' }] })
    store.set({ cards: [makeCard('a')] })
    store.slice._pushHistory()
    expect(store.get().future).toHaveLength(0)
  })

  it('should limit past stack to 50 entries', () => {
    for (let i = 0; i < 55; i++) {
      store.set({ cards: [makeCard(`card_${i}`)] })
      store.slice._pushHistory()
    }
    expect(store.get().past).toHaveLength(50)
    // Oldest entry should be dropped
    expect(store.get().past[0][0].id).not.toBe('card_0')
  })

  it('should snapshot only card fields (not transient state)', () => {
    store.set({ cards: [makeCard('a', { x: 500, y: 300 })] })
    store.slice._pushHistory()
    const snap = store.get().past[0][0]
    expect(snap.x).toBe(500)
    expect(snap.y).toBe(300)
    expect(snap.id).toBe('a')
    // Should not include unrelated state
    expect(snap.selectedIds).toBeUndefined()
  })
})

describe('historySlice — undo', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should restore previous snapshot', () => {
    store.set({ cards: [makeCard('a', { x: 0, y: 0 })] })
    store.slice._pushHistory()
    store.set({ cards: [makeCard('a', { x: 100, y: 200 })] })
    store.slice.undo()
    const cards = store.get().cards
    expect(cards[0].x).toBe(0)
    expect(cards[0].y).toBe(0)
  })

  it('should push current state onto future for redo', () => {
    store.set({ cards: [makeCard('a', { x: 0 })] })
    store.slice._pushHistory()
    store.set({ cards: [makeCard('a', { x: 100 })] })
    store.slice.undo()
    expect(store.get().future).toHaveLength(1)
    // Future should contain the state we just undid from
  })

  it('should do nothing when past is empty', () => {
    store.set({ cards: [makeCard('a')] })
    store.slice.undo()
    expect(store.get().cards).toHaveLength(1)
    expect(store.get().past).toHaveLength(0)
  })

  it('should restore multiple cards', () => {
    store.set({ cards: [makeCard('a'), makeCard('b'), makeCard('c')] })
    store.slice._pushHistory()
    store.set({ cards: [makeCard('a'), makeCard('c')] }) // removed 'b'
    store.slice.undo()
    expect(store.get().cards).toHaveLength(3)
    expect(store.get().cards.map(c => c.id)).toContain('b')
  })

  it('should sync selection after undo (remove stale ids)', () => {
    store.set({ cards: [makeCard('a'), makeCard('b')], selectedIds: ['a', 'b'] })
    store.slice._pushHistory()
    // Add card 'c' and select only 'c'
    store.set({ cards: [makeCard('a'), makeCard('b'), makeCard('c')], selectedIds: ['c'] })
    store.slice.undo()
    // After undo, 'c' is gone, so selectedIds should be empty (filter stale)
    expect(store.get().cards).toHaveLength(2)
    expect(store.get().selectedIds).toEqual([])
  })

  it('should chain multiple undos', () => {
    store.set({ cards: [makeCard('a', { x: 0 })] })
    store.slice._pushHistory()
    store.set({ cards: [makeCard('a', { x: 50 })] })
    store.slice._pushHistory()
    store.set({ cards: [makeCard('a', { x: 100 })] })

    store.slice.undo()
    expect(store.get().cards[0].x).toBe(50)
    store.slice.undo()
    expect(store.get().cards[0].x).toBe(0)
    store.slice.undo()
    expect(store.get().cards[0].x).toBe(0) // no more past — stays at 0
  })
})

describe('historySlice — redo', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should restore next future state', () => {
    store.set({ cards: [makeCard('a', { x: 0 })] })
    store.slice._pushHistory()
    store.set({ cards: [makeCard('a', { x: 100 })] })
    store.slice.undo()
    expect(store.get().cards[0].x).toBe(0)
    store.slice.redo()
    expect(store.get().cards[0].x).toBe(100)
  })

  it('should do nothing when future is empty', () => {
    store.set({ cards: [makeCard('a')] })
    store.slice._pushHistory()
    store.slice.redo()
    expect(store.get().past).toHaveLength(1)
    expect(store.get().future).toHaveLength(0)
  })

  it('should clear future on new action', () => {
    store.set({ cards: [makeCard('a', { x: 0 })] })
    store.slice._pushHistory()
    store.set({ cards: [makeCard('a', { x: 100 })] })
    store.slice.undo() // future now has x=100

    // New action pushes history → clears future
    store.set({ cards: [makeCard('a', { x: 200 })] })
    store.slice._pushHistory()
    expect(store.get().future).toHaveLength(0)
  })
})

describe('historySlice — clearHistory', () => {
  it('should clear both past and future', () => {
    const store = createMockStore()
    store.set({ cards: [makeCard('a')] })
    store.slice._pushHistory()
    store.slice._pushHistory()
    store.set({ future: [{ id: 'x' }] })
    store.slice.clearHistory()
    expect(store.get().past).toHaveLength(0)
    expect(store.get().future).toHaveLength(0)
  })
})

describe('historySlice — canUndo / canRedo', () => {
  it('should report undo/redo availability', () => {
    const store = createMockStore()
    expect(store.slice.canUndo()).toBe(false)
    expect(store.slice.canRedo()).toBe(false)

    store.set({ cards: [makeCard('a')] })
    store.slice._pushHistory()
    expect(store.slice.canUndo()).toBe(true)
    expect(store.slice.canRedo()).toBe(false)

    store.slice.undo()
    expect(store.slice.canUndo()).toBe(false)
    expect(store.slice.canRedo()).toBe(true)
  })
})
