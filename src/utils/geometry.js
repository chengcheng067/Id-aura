/**
 * Geometry utilities: bounds calculation, alignment, arrangement, hit testing, snapping.
 *
 * All functions are PURE — no side effects, no store access.
 */

/**
 * Get the bounding rectangle for a card.
 * @param {object} card - card object with x, y, width, height
 * @returns {{ id: string, x: number, y: number, w: number, h: number, r: number, b: number, cx: number, cy: number }}
 */
export function getCardBounds(card) {
  const w = typeof card.width === 'number' ? card.width : 220
  const h = typeof card.height === 'number' ? card.height : 200
  return {
    id: card.id,
    x: card.x,
    y: card.y,
    w,
    h,
    r: card.x + w,
    b: card.y + h,
    cx: card.x + w / 2,
    cy: card.y + h / 2,
  }
}

/**
 * Align a set of card bounds by the given type.
 * @param {Array<ReturnType<getCardBounds>>} bounds
 * @param {'left'|'center-x'|'right'|'top'|'center-y'|'bottom'|'distribute-x'|'distribute-y'} type
 * @returns {Record<string, {x?: number, y?: number}>} map of card id → position updates
 */
export function alignCards(bounds, type) {
  const updates = {}

  switch (type) {
    case 'left': {
      const targetX = Math.min(...bounds.map(b => b.x))
      bounds.forEach(b => {
        updates[b.id] = { x: targetX }
      })
      break
    }
    case 'center-x': {
      const minX = Math.min(...bounds.map(b => b.x))
      const maxR = Math.max(...bounds.map(b => b.r))
      const center = (minX + maxR) / 2
      bounds.forEach(b => {
        updates[b.id] = { x: Math.round(center - b.w / 2) }
      })
      break
    }
    case 'right': {
      const maxR = Math.max(...bounds.map(b => b.r))
      bounds.forEach(b => {
        updates[b.id] = { x: Math.round(maxR - b.w) }
      })
      break
    }
    case 'top': {
      const targetY = Math.min(...bounds.map(b => b.y))
      bounds.forEach(b => {
        updates[b.id] = { y: targetY }
      })
      break
    }
    case 'center-y': {
      const minY = Math.min(...bounds.map(b => b.y))
      const maxB = Math.max(...bounds.map(b => b.b))
      const center = (minY + maxB) / 2
      bounds.forEach(b => {
        updates[b.id] = { y: Math.round(center - b.h / 2) }
      })
      break
    }
    case 'bottom': {
      const maxB = Math.max(...bounds.map(b => b.b))
      bounds.forEach(b => {
        updates[b.id] = { y: Math.round(maxB - b.h) }
      })
      break
    }
    case 'distribute-x': {
      const sorted = [...bounds].sort((a, b) => a.x - b.x)
      if (sorted.length < 3) break
      const totalW = sorted.reduce((s, b) => s + b.w, 0)
      const minX = sorted[0].x
      const maxR = sorted[sorted.length - 1].r
      const gap = (maxR - minX - totalW) / (sorted.length - 1)
      let cx = minX
      sorted.forEach(b => {
        updates[b.id] = { x: Math.round(cx) }
        cx += b.w + gap
      })
      break
    }
    case 'distribute-y': {
      const sorted = [...bounds].sort((a, b) => a.y - b.y)
      if (sorted.length < 3) break
      const totalH = sorted.reduce((s, b) => s + b.h, 0)
      const minY = sorted[0].y
      const maxB = sorted[sorted.length - 1].b
      const gap = (maxB - minY - totalH) / (sorted.length - 1)
      let cy = minY
      sorted.forEach(b => {
        updates[b.id] = { y: Math.round(cy) }
        cy += b.h + gap
      })
      break
    }
  }

  return updates
}

/**
 * Arrange image cards in a grid layout.
 * @param {Array} imageCards - all image-type cards
 * @param {'optimal'|'name'|'path'|'order'|'addition'|'random'} mode
 * @returns {Record<string, {x: number, y: number}>} map of card id → position
 */
export function arrangeCards(imageCards, mode) {
  const cols = Math.ceil(Math.sqrt(imageCards.length))
  const gap = 6

  // Bounding box top-left as the arrangement origin
  const originX = Math.min(...imageCards.map(c => c.x ?? 0))
  const originY = Math.min(...imageCards.map(c => c.y ?? 0))

  let sorted
  switch (mode) {
    case 'optimal':
      sorted = [...imageCards].sort((a, b) => {
        const aArea = (a.width || 280) * (typeof a.height === 'number' ? a.height : 200)
        const bArea = (b.width || 280) * (typeof b.height === 'number' ? b.height : 200)
        return bArea - aArea
      })
      break
    case 'name':
      sorted = [...imageCards].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'zh')
      )
      break
    case 'path':
      sorted = [...imageCards].sort((a, b) =>
        (a.imageUrl || '').localeCompare(b.imageUrl || '')
      )
      break
    case 'order':
      sorted = [...imageCards]
      break
    case 'addition':
      sorted = [...imageCards].sort((a, b) =>
        (a.id || '').localeCompare(b.id || '')
      )
      break
    case 'random':
      sorted = [...imageCards].sort(() => Math.random() - 0.5)
      break
    default:
      sorted = [...imageCards]
  }

  // Build grid rows/cols with actual image sizes for compact spacing
  const rows = []
  for (let i = 0; i < sorted.length; i += cols) {
    rows.push(sorted.slice(i, i + cols))
  }

  // Flow layout: each row starts from originX, cards use their own width
  // (no global column-width alignment that leaves gaps when rows have
  // different card sizes — spec v3.2 fix for "bottom row not left-packed")
  const updates = {}
  let y = originY
  rows.forEach((row) => {
    let x = originX
    const rowH = Math.max(...row.map(c => (typeof c.height === 'number' ? c.height : 200)))
    row.forEach((c) => {
      updates[c.id] = { x, y }
      x += (c.width || 280) + gap
    })
    y += rowH + gap
  })

  return updates
}

/**
 * Hit-test: which cards fall inside a box selection rectangle?
 * @param {Array} cards - all cards
 * @param {{ x: number, y: number, w: number, h: number }} box - selection box in canvas coords
 * @returns {string[]} array of card ids inside the box
 */
export function hitTest(cards, box) {
  return cards
    .filter(c => {
      const cw = typeof c.width === 'number' ? c.width : 220
      const ch = typeof c.height === 'number' ? c.height : 200
      return (
        c.x + cw > box.x &&
        c.x < box.x + box.w &&
        c.y + ch > box.y &&
        c.y < box.y + box.h
      )
    })
    .map(c => c.id)
}

/**
 * Snap a card position to alignment guides of nearby cards.
 * @param {Array} cards - all cards
 * @param {string} excludeId - card being dragged (exclude from comparison)
 * @param {number} newX - proposed new x
 * @param {number} newY - proposed new y
 * @param {number} w - card width
 * @param {number} h - card height
 * @param {number} scale - current canvas scale
 * @returns {{ x: number, y: number, guides: { v: Array, h: Array } }}
 */
export function calcSnap(cards, excludeId, newX, newY, w, h, scale) {
  const SNAP = 8 / scale
  const otherCards = cards.filter(c => c.id !== excludeId)
  const guides = { v: [], h: [] }

  const cx = newX + w / 2
  const cy = newY + h / 2
  const right = newX + w
  const bottom = newY + h

  otherCards.forEach(c => {
    const cw = typeof c.width === 'number' ? c.width : 220
    const ch = typeof c.height === 'number' ? c.height : 200
    const or = c.x + cw
    const ob = c.y + ch
    const ocx = c.x + cw / 2
    const ocy = c.y + ch / 2

    if (Math.abs(newX - c.x) < SNAP) guides.v.push({ x: c.x, pos: 'left' })
    if (Math.abs(right - or) < SNAP) guides.v.push({ x: or - w, pos: 'right' })
    if (Math.abs(cx - ocx) < SNAP) guides.v.push({ x: ocx - w / 2, pos: 'center-x' })
    if (Math.abs(newY - c.y) < SNAP) guides.h.push({ y: c.y, pos: 'top' })
    if (Math.abs(bottom - ob) < SNAP) guides.h.push({ y: ob - h, pos: 'bottom' })
    if (Math.abs(cy - ocy) < SNAP) guides.h.push({ y: ocy - h / 2, pos: 'center-y' })
  })

  let snappedX = newX
  let snappedY = newY
  if (guides.v.length > 0) snappedX = guides.v[0].x
  if (guides.h.length > 0) snappedY = guides.h[0].y

  return { x: snappedX, y: snappedY, guides }
}
