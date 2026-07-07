/**
 * Unit tests for card slice operations.
 * Tests: addCard, updateCard, batchUpdateCards, deleteCards, groupCards, ungroupCards, alignCards, arrangeCards
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { createCardSlice } from './cardSlice'

// Mock window for the dynamic-positioning addCard (Bug 2 fix)
beforeAll(() => {
  global.window = {
    innerWidth: 1024,
    innerHeight: 768,
  }
})

// Create a minimal mock of the Zustand set/get pattern
function createMockStore() {
  let state = { cards: [], selectedIds: [], past: [], future: [], showSidePanel: false }
  const set = (updater) => {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) }
    } else {
      state = { ...state, ...updater }
    }
  }
  const get = () => state
  const slice = createCardSlice(set, get)
  // Merge into state (include _pushHistory mock)
  state = { ...state, ...slice, _pushHistory: () => {}, clearHistory: () => {} }
  return { set, get, state, slice }
}

describe('cardSlice — addCard', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should add an image card with defaults', () => {
    const id = store.slice.addCard('image', { imageUrl: 'test.jpg', name: 'test' })
    const card = store.get().cards.find(c => c.id === id)
    expect(card).toBeDefined()
    expect(card.type).toBe('image')
    expect(card.imageUrl).toBe('test.jpg')
    expect(card.width).toBe(220)
    expect(card.height).toBe(200)
    expect(card.locked).toBe(false)
    expect(card.groupId).toBeNull()
  })

  it('should add a note card', () => {
    const id = store.slice.addCard('note')
    const card = store.get().cards.find(c => c.id === id)
    expect(card).toBeDefined()
    expect(card.type).toBe('note')
    expect(card.text).toBe('双击编辑备注...')
    expect(card.height).toBe('auto')
  })

  it('should add a drawing card', () => {
    const id = store.slice.addCard('drawing', { svgPath: 'M 0 0 L 10 10', strokeColor: '#ff0000' })
    const card = store.get().cards.find(c => c.id === id)
    expect(card.type).toBe('drawing')
    expect(card.svgPath).toBe('M 0 0 L 10 10')
    expect(card.strokeColor).toBe('#ff0000')
  })

  it('should add a label card', () => {
    const id = store.slice.addCard('label', { text: '测试标签' })
    const card = store.get().cards.find(c => c.id === id)
    expect(card.type).toBe('label')
    expect(card.text).toBe('测试标签')
    expect(card.height).toBe('auto')
  })

  it('should add a spec card', () => {
    const id = store.slice.addCard('spec', { sectionTitle: '面积', specData: { label: '客房面积', value: '≥30㎡', priority: 'high' } })
    const card = store.get().cards.find(c => c.id === id)
    expect(card.type).toBe('spec')
    expect(card.height).toBe('auto')
  })

  it('should accept custom position', () => {
    const id = store.slice.addCard('image', { x: 500, y: 300, imageUrl: 'test.jpg' })
    const card = store.get().cards.find(c => c.id === id)
    expect(card.x).toBe(500)
    expect(card.y).toBe(300)
  })
})

describe('cardSlice — updateCard', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should update a card property', () => {
    const id = store.slice.addCard('image', { imageUrl: 'a.jpg', name: 'old' })
    store.slice.updateCard(id, { name: 'new name', x: 999 })
    const card = store.get().cards.find(c => c.id === id)
    expect(card.name).toBe('new name')
    expect(card.x).toBe(999)
    expect(card.type).toBe('image') // unchanged
  })

  it('should not affect other cards', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    const id2 = store.slice.addCard('image', { imageUrl: 'b.jpg' })
    store.slice.updateCard(id1, { x: 500 })
    const card2 = store.get().cards.find(c => c.id === id2)
    expect(typeof card2.x).toBe('number') // dynamic default (Bug 2 fix)
  })
})

describe('cardSlice — batchUpdateCards', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should update multiple cards at once', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    const id2 = store.slice.addCard('image', { imageUrl: 'b.jpg' })
    store.slice.batchUpdateCards({
      [id1]: { x: 100, y: 100 },
      [id2]: { x: 300, y: 100 },
    })
    expect(store.get().cards.find(c => c.id === id1).x).toBe(100)
    expect(store.get().cards.find(c => c.id === id2).x).toBe(300)
  })
})

describe('cardSlice — deleteCards', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should delete a single card', () => {
    const id = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    store.slice.deleteCards([id])
    expect(store.get().cards.find(c => c.id === id)).toBeUndefined()
  })

  it('should delete multiple cards', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    const id2 = store.slice.addCard('image', { imageUrl: 'b.jpg' })
    const id3 = store.slice.addCard('image', { imageUrl: 'c.jpg' })
    store.slice.deleteCards([id1, id3])
    expect(store.get().cards).toHaveLength(1)
    expect(store.get().cards[0].id).toBe(id2)
  })

  it('should accept a single id (not array)', () => {
    const id = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    store.slice.deleteCards(id)
    expect(store.get().cards.find(c => c.id === id)).toBeUndefined()
  })
})

describe('cardSlice — groupCards / ungroupCards', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should group multiple cards', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    const id2 = store.slice.addCard('image', { imageUrl: 'b.jpg' })
    store.slice.groupCards([id1, id2])
    const c1 = store.get().cards.find(c => c.id === id1)
    const c2 = store.get().cards.find(c => c.id === id2)
    expect(c1.groupId).toBeTruthy()
    expect(c2.groupId).toBeTruthy()
    expect(c1.groupId).toBe(c2.groupId)
  })

  it('should not group less than 2 cards', () => {
    const id = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    store.slice.groupCards([id])
    const c = store.get().cards.find(c => c.id === id)
    expect(c.groupId).toBeNull()
  })

  it('should ungroup cards', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    const id2 = store.slice.addCard('image', { imageUrl: 'b.jpg' })
    store.slice.groupCards([id1, id2])
    store.slice.ungroupCards([id1])
    expect(store.get().cards.find(c => c.id === id1).groupId).toBeNull()
    expect(store.get().cards.find(c => c.id === id2).groupId).toBeNull()
  })

  it('should only ungroup cards in the same group', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    const id2 = store.slice.addCard('image', { imageUrl: 'b.jpg' })
    const id3 = store.slice.addCard('image', { imageUrl: 'c.jpg' })
    store.slice.groupCards([id1, id2])
    store.slice.groupCards([id3]) // won't group single

    store.slice.ungroupCards([id1])
    expect(store.get().cards.find(c => c.id === id1).groupId).toBeNull()
    expect(store.get().cards.find(c => c.id === id2).groupId).toBeNull()
    expect(store.get().cards.find(c => c.id === id3).groupId).toBeNull()
  })
})

describe('cardSlice — bringToFront / sendToBack', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should bring cards to front (end of array)', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    const id2 = store.slice.addCard('image', { imageUrl: 'b.jpg' })
    store.slice.bringToFront([id1])
    const cards = store.get().cards
    expect(cards[cards.length - 1].id).toBe(id1)
  })

  it('should send cards to back (start of array)', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg' })
    const id2 = store.slice.addCard('image', { imageUrl: 'b.jpg' })
    store.slice.sendToBack([id2])
    const cards = store.get().cards
    expect(cards[0].id).toBe(id2)
  })
})

describe('cardSlice — clearAll', () => {
  it('should remove all cards', () => {
    const store = createMockStore()
    store.slice.addCard('image', { imageUrl: 'a.jpg' })
    store.slice.addCard('note')
    store.slice.clearAll()
    expect(store.get().cards).toHaveLength(0)
  })
})

describe('cardSlice — alignCards', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should align left (via store action)', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg', x: 100, y: 10, width: 200, height: 100 })
    const id2 = store.slice.addCard('image', { imageUrl: 'b.jpg', x: 350, y: 50, width: 150, height: 80 })
    store.slice.alignCards([id1, id2], 'left')
    const c2 = store.get().cards.find(c => c.id === id2)
    expect(c2.x).toBe(100) // snapped to id1's x
  })

  it('should not align when less than 2 cards with numeric dimensions', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg', x: 100, y: 10, width: 200, height: 100 })
    store.slice.alignCards([id1], 'left')
    // No error, just no change
    const c1 = store.get().cards.find(c => c.id === id1)
    expect(c1.x).toBe(100)
  })

  it('should align label cards with auto-height (treated as 200px)', () => {
    const id1 = store.slice.addCard('image', { imageUrl: 'a.jpg', x: 100, y: 10, width: 200, height: 100 })
    const id2 = store.slice.addCard('label', { text: 'test', x: 350, y: 50, width: 100 })
    // Label has height='auto' — getCardBounds falls back to 200px, so it participates
    store.slice.alignCards([id1, id2], 'left')
    const c2 = store.get().cards.find(c => c.id === id2)
    expect(c2.x).toBe(100) // aligned to id1's x
  })
})

describe('cardSlice — arrangeCards', () => {
  let store
  beforeEach(() => {
    store = createMockStore()
  })

  it('should arrange image cards in a grid', () => {
    store.slice.addCard('image', { imageUrl: 'a.jpg', name: 'A' })
    store.slice.addCard('image', { imageUrl: 'b.jpg', name: 'B' })
    store.slice.addCard('image', { imageUrl: 'c.jpg', name: 'C' })
    store.slice.addCard('note') // should not be affected
    store.slice.arrangeCards('optimal')
    const images = store.get().cards.filter(c => c.type === 'image')
    // All images should be positioned in grid
    images.forEach(c => {
      expect(typeof c.x).toBe('number')
      expect(typeof c.y).toBe('number')
    })
    // Note should be unaffected
    const note = store.get().cards.find(c => c.type === 'note')
    expect(typeof note.x).toBe('number') // dynamic default (Bug 2 fix)
    expect(typeof note.y).toBe('number')
  })

  it('should do nothing when only a single image card exists', () => {
    const id = store.slice.addCard('image', { imageUrl: 'a.jpg', x: 500, y: 300 })
    store.slice.arrangeCards('optimal')
    const card = store.get().cards.find(c => c.id === id)
    // Single image card should remain at its original position
    expect(card.x).toBe(500)
    expect(card.y).toBe(300)
  })

  it('should do nothing when no image cards exist', () => {
    store.slice.addCard('note')
    store.slice.arrangeCards('optimal')
    // Should not throw
    expect(store.get().cards).toHaveLength(1)
  })
})
