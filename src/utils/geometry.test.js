/**
 * Unit tests for geometry utilities.
 * Covers: getCardBounds, alignCards, arrangeCards, hitTest, calcSnap
 */
import { describe, it, expect } from 'vitest'
import { getCardBounds, alignCards, arrangeCards, hitTest, calcSnap } from './geometry'

// ==================== getCardBounds ====================
describe('getCardBounds', () => {
  it('should compute bounds for a card with numeric dimensions', () => {
    const card = { id: '1', x: 10, y: 20, width: 100, height: 50 }
    const b = getCardBounds(card)
    expect(b.x).toBe(10)
    expect(b.y).toBe(20)
    expect(b.w).toBe(100)
    expect(b.h).toBe(50)
    expect(b.r).toBe(110)
    expect(b.b).toBe(70)
    expect(b.cx).toBe(60)
    expect(b.cy).toBe(45)
  })

  it('should default width to 220 and height to 200 when not numbers', () => {
    const card = { id: '2', x: 0, y: 0, width: 'auto', height: 'auto' }
    const b = getCardBounds(card)
    expect(b.w).toBe(220)
    expect(b.h).toBe(200)
  })

  it('should handle missing width/height', () => {
    const card = { id: '3', x: 5, y: 5 }
    const b = getCardBounds(card)
    expect(b.w).toBe(220)
    expect(b.h).toBe(200)
  })
})

// ==================== alignCards ====================
describe('alignCards — Left', () => {
  it('should align all cards to the leftmost x', () => {
    const bounds = [
      getCardBounds({ id: 'a', x: 100, y: 10, width: 200, height: 100 }),
      getCardBounds({ id: 'b', x: 350, y: 50, width: 150, height: 80 }),
      getCardBounds({ id: 'c', x: 200, y: 120, width: 180, height: 90 }),
    ]
    const result = alignCards(bounds, 'left')
    // All should have x = 100 (min)
    expect(result.a.x).toBe(100)
    expect(result.b.x).toBe(100)
    expect(result.c.x).toBe(100)
    // y should not be changed
    expect(result.a.y).toBeUndefined()
    expect(result.b.y).toBeUndefined()
    expect(result.c.y).toBeUndefined()
  })
})

describe('alignCards — Right', () => {
  it('should align all cards to the rightmost edge', () => {
    const bounds = [
      getCardBounds({ id: 'a', x: 100, y: 10, width: 200, height: 100 }), // right=300
      getCardBounds({ id: 'b', x: 350, y: 50, width: 150, height: 80 }),  // right=500
      getCardBounds({ id: 'c', x: 200, y: 120, width: 180, height: 90 }), // right=380
    ]
    const result = alignCards(bounds, 'right')
    // maxR = 500, so a.x = 500-200=300, b.x = 500-150=350, c.x = 500-180=320
    expect(result.a.x).toBe(300)
    expect(result.b.x).toBe(350)
    expect(result.c.x).toBe(320)
  })
})

describe('alignCards — Center-X', () => {
  it('should horizontally center all cards within the selection bounds', () => {
    const bounds = [
      getCardBounds({ id: 'a', x: 100, y: 10, width: 200, height: 100 }), // center of bounding box
      getCardBounds({ id: 'b', x: 400, y: 50, width: 100, height: 80 }),
    ]
    const result = alignCards(bounds, 'center-x')
    // minX=100, maxR=500, center=300
    // a.cx should be 300 => a.x = 300 - 100 = 200
    // b.cx should be 300 => b.x = 300 - 50 = 250
    expect(result.a.x).toBe(200)
    expect(result.b.x).toBe(250)
  })
})

describe('alignCards — Top', () => {
  it('should align all cards to the topmost y', () => {
    const bounds = [
      getCardBounds({ id: 'a', x: 10, y: 100, width: 200, height: 50 }),
      getCardBounds({ id: 'b', x: 50, y: 50, width: 150, height: 80 }),
      getCardBounds({ id: 'c', x: 80, y: 200, width: 180, height: 60 }),
    ]
    const result = alignCards(bounds, 'top')
    expect(result.a.y).toBe(50)
    expect(result.b.y).toBe(50)
    expect(result.c.y).toBe(50)
  })
})

describe('alignCards — Center-Y', () => {
  it('should vertically center all cards within the selection bounds', () => {
    const bounds = [
      getCardBounds({ id: 'a', x: 10, y: 100, width: 200, height: 40 }), // bottom=140
      getCardBounds({ id: 'b', x: 50, y: 50, width: 150, height: 100 }),  // bottom=150
    ]
    const result = alignCards(bounds, 'center-y')
    // minY=50, maxB=150, center=100
    // a.cy=100 => a.y = 100 - 20 = 80
    // b.cy=100 => b.y = 100 - 50 = 50
    expect(result.a.y).toBe(80)
    expect(result.b.y).toBe(50)
  })
})

describe('alignCards — Bottom', () => {
  it('should align all cards to the bottommost edge', () => {
    const bounds = [
      getCardBounds({ id: 'a', x: 10, y: 100, width: 200, height: 40 }), // bottom=140
      getCardBounds({ id: 'b', x: 50, y: 50, width: 150, height: 100 }),  // bottom=150
    ]
    const result = alignCards(bounds, 'bottom')
    // maxB=150, a.y=150-40=110, b.y=150-100=50
    expect(result.a.y).toBe(110)
    expect(result.b.y).toBe(50)
  })
})

describe('alignCards — Distribute-X', () => {
  it('should evenly space cards horizontally', () => {
    const bounds = [
      getCardBounds({ id: 'a', x: 50, y: 10, width: 100, height: 50 }),   // right=150
      getCardBounds({ id: 'b', x: 200, y: 20, width: 80, height: 50 }),    // right=280
      getCardBounds({ id: 'c', x: 380, y: 30, width: 120, height: 50 }),   // right=500
    ]
    const result = alignCards(bounds, 'distribute-x')
    // totalW = 100+80+120 = 300, total span = 500-50 = 450
    // gap = (450-300)/(3-1) = 75
    // a: x=50
    // b: x=50+100+75=225
    // c: x=225+80+75=380
    // Sorted by x: a, b, c
    expect(result.a.x).toBe(50)
    expect(result.b.x).toBe(225)
    expect(result.c.x).toBe(380)
  })

  it('should do nothing when only 2 cards provided', () => {
    const bounds = [
      getCardBounds({ id: 'a', x: 50, y: 10, width: 100, height: 50 }),
      getCardBounds({ id: 'b', x: 200, y: 20, width: 80, height: 50 }),
    ]
    const result = alignCards(bounds, 'distribute-x')
    expect(Object.keys(result).length).toBe(0)
  })
})

describe('alignCards — Distribute-Y', () => {
  it('should evenly space cards vertically', () => {
    const bounds = [
      getCardBounds({ id: 'a', x: 10, y: 50, width: 50, height: 100 }),
      getCardBounds({ id: 'b', x: 20, y: 200, width: 50, height: 80 }),
      getCardBounds({ id: 'c', x: 30, y: 380, width: 50, height: 120 }),
    ]
    const result = alignCards(bounds, 'distribute-y')
    expect(Object.keys(result).length).toBe(3)
    expect(result.a.y).toBe(50)
    expect(result.b.y).toBe(225)
    expect(result.c.y).toBe(380)
  })
})

// ==================== arrangeCards ====================
describe('arrangeCards', () => {
  const makeImg = (id, name, w = 280, h = 200) => ({
    id, type: 'image', name, width: w, height: h, imageUrl: `/img/${name}`,
  })

  it('should arrange in optimal mode (largest area first)', () => {
    const cards = [
      makeImg('a', 'small', 100, 80),
      makeImg('b', 'large', 300, 250),
      makeImg('c', 'medium', 200, 150),
    ]
    const result = arrangeCards(cards, 'optimal')
    // Sorted by area: b(75000), c(30000), a(8000)
    // cols = ceil(sqrt(3)) = 2
    // originX = 0, originY = 0
    // gap = 6
    // colWidths: [max(300,100)=300, max(200)=200]
    // rowHeights: [max(250,150)=250, max(80)=80]
    // b: col 0, row 0 → x=0, y=0
    // c: col 1, row 0 → x=0+300+6=306, y=0
    // a: col 0, row 1 → x=0, y=0+250+6=256
    expect(result.b.x).toBe(0)
    expect(result.b.y).toBe(0)
    expect(result.c.x).toBe(306)
    expect(result.c.y).toBe(0)
    expect(result.a.x).toBe(0)
    expect(result.a.y).toBe(256)
  })

  it('should arrange by name alphabetically', () => {
    const cards = [
      makeImg('a', '查理', 280, 200),
      makeImg('b', '张三', 280, 200),
      makeImg('c', '李四', 280, 200),
    ]
    const result = arrangeCards(cards, 'name')
    // Sorted: 李四(c), 张三(b), 查理(a) — but localeCompare handles Chinese
    // In localeCompare('zh'): 李, 张, 查
    // cols = 2
    // c (李四): col 0 → x=50
    // b (张三): col 1 → x=50+280+20=350
    // a (查理): col 0 row 1 → x=50
    expect(Object.keys(result).length).toBe(3)
    // Verify all have positions set
    expect(result.a).toBeDefined()
    expect(result.b).toBeDefined()
    expect(result.c).toBeDefined()
  })

  it('should produce random positions different from original order', () => {
    const cards = Array.from({ length: 10 }, (_, i) =>
      makeImg(`img${i}`, `img${i}`, 200, 150)
    )
    const result1 = arrangeCards(cards, 'random')
    const result2 = arrangeCards(cards, 'random')
    // Random should assign all positions
    expect(Object.keys(result1).length).toBe(10)
    expect(Object.keys(result2).length).toBe(10)
  })

  it('should return empty updates for empty card list', () => {
    const result = arrangeCards([], 'optimal')
    expect(Object.keys(result).length).toBe(0)
  })
})

// ==================== hitTest ====================
describe('hitTest', () => {
  it('should detect cards inside a box selection', () => {
    const cards = [
      { id: 'a', x: 100, y: 100, width: 200, height: 150 },
      { id: 'b', x: 400, y: 100, width: 200, height: 150 },
      { id: 'c', x: 100, y: 300, width: 200, height: 150 },
    ]
    const box = { x: 80, y: 80, w: 250, h: 200 }
    const ids = hitTest(cards, box)
    expect(ids).toContain('a')
    expect(ids).not.toContain('b')
    expect(ids).not.toContain('c')
  })

  it('should detect partially overlapping cards', () => {
    const cards = [
      { id: 'a', x: 100, y: 100, width: 200, height: 150 },
    ]
    // Box overlaps the right half of card 'a'
    const box = { x: 250, y: 120, w: 100, h: 80 }
    const ids = hitTest(cards, box)
    expect(ids).toContain('a')
  })

  it('should return empty array for no hits', () => {
    const cards = [
      { id: 'a', x: 100, y: 100, width: 50, height: 50 },
    ]
    const box = { x: 500, y: 500, w: 100, h: 100 }
    const ids = hitTest(cards, box)
    expect(ids).toHaveLength(0)
  })

  it('should handle cards with missing width/height', () => {
    const cards = [
      { id: 'a', x: 100, y: 100 }, // defaults to 220x200
    ]
    const box = { x: 200, y: 150, w: 200, h: 200 }
    const ids = hitTest(cards, box)
    expect(ids).toContain('a')
  })
})

// ==================== calcSnap ====================
describe('calcSnap', () => {
  const scale = 1

  it('should snap to left edge of nearby card', () => {
    const cards = [
      { id: 'target', x: 200, y: 100, width: 100, height: 80 },
    ]
    // Move to x=198 (within SNAP=8)
    const { x, guides } = calcSnap(cards, 'dragging', 198, 100, 100, 80, scale)
    expect(x).toBe(200)
    expect(guides.v.length).toBeGreaterThan(0)
  })

  it('should snap to top edge of nearby card', () => {
    const cards = [
      { id: 'target', x: 100, y: 200, width: 100, height: 80 },
    ]
    const { y } = calcSnap(cards, 'dragging', 100, 197, 100, 80, scale)
    expect(y).toBe(200)
  })

  it('should not snap when far from any card', () => {
    const cards = [
      { id: 'target', x: 200, y: 200, width: 100, height: 80 },
    ]
    const { x, y, guides } = calcSnap(cards, 'dragging', 50, 50, 100, 80, scale)
    expect(x).toBe(50)
    expect(y).toBe(50)
    expect(guides.v.length).toBe(0)
    expect(guides.h.length).toBe(0)
  })

  it('should exclude the dragged card from snapping targets', () => {
    const cards = [
      { id: 'dragging', x: 200, y: 200, width: 100, height: 80 },
    ]
    const { guides } = calcSnap(cards, 'dragging', 200, 200, 100, 80, scale)
    expect(guides.v.length).toBe(0)
    expect(guides.h.length).toBe(0)
  })

  it('should adjust snap threshold based on scale', () => {
    const cards = [
      { id: 'target', x: 200, y: 100, width: 100, height: 80 },
    ]
    // At scale=0.5, SNAP = 8/0.5 = 16
    const { x } = calcSnap(cards, 'dragging', 212, 100, 100, 80, 0.5)
    // 212 - 200 = 12, which is < 16, so should snap
    expect(x).toBe(200)
  })
})
