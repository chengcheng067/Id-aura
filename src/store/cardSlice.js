import { nanoid } from 'nanoid'
import {
  alignCards as doAlign,
  arrangeCards as doArrange,
  getCardBounds,
} from '../utils/geometry'

export const createCardSlice = (set, get) => ({
  cards: [],

  /**
   * Add a new card of the specified type.
   * @param {'image'|'note'|'drawing'|'label'|'spec'} type
   * @param {object} props - override defaults
   * @returns {string} the new card id
   */
  addCard: (type, props = {}) => {
    get()._pushHistory()

    const state = get()
    const id = nanoid()

    // Compute canvas-relative center with random offset to avoid overlapping
    const CARD_DEFAULT_W = props.width ?? 220
    const CARD_DEFAULT_H = (type === 'note' || type === 'label' || type === 'spec') ? 200 : (props.height ?? 200)
    const TOOLBAR_H = 48
    const SIDEBAR_W = 300
    const sidebarOpen = state.showSidePanel

    const canvasStartX = sidebarOpen ? SIDEBAR_W : 0
    const canvasW = window.innerWidth - canvasStartX
    const canvasH = window.innerHeight - TOOLBAR_H

    const centerX = canvasStartX + canvasW / 2
    const centerY = TOOLBAR_H + canvasH / 2

    // Stagger offset to reduce overlap when adding multiple cards quickly
    const count = state.cards.length
    const offsetX = ((count * 37) % 160) - 80
    const offsetY = ((count * 29) % 120) - 60

    const base = {
      id,
      type,
      x: props.x ?? Math.round(centerX - CARD_DEFAULT_W / 2 + offsetX),
      y: props.y ?? Math.round(centerY - CARD_DEFAULT_H / 2 + offsetY),
      width: props.width ?? 220,
      height: props.height ?? 200,
      rotation: 0,
      zIndex: state.cards.length,
      locked: false,
      groupId: null,
      opacity: 1,
    }

    const card = { ...base, ...props }

    switch (type) {
      case 'image':
        card.imageUrl = card.imageUrl ?? ''
        card.name = card.name ?? '图片'
        card.flipH = card.flipH ?? false
        card.flipV = card.flipV ?? false
        card.note = card.note ?? ''
        card.sourceUrl = card.sourceUrl ?? ''
        card.sourceType = card.sourceType ?? ''
        card.naturalWidth = card.naturalWidth ?? 0
        card.naturalHeight = card.naturalHeight ?? 0
        break
      case 'note':
        card.text = card.text ?? '双击编辑备注...'
        card.fontSize = card.fontSize ?? 13
        card.color = card.color ?? '#fff'
        card.autoSize = card.autoSize ?? true
        card.height = 'auto'
        break
      case 'drawing':
        card.svgPath = card.svgPath ?? ''
        card.strokeColor = card.strokeColor ?? '#5b9bd5'
        card.strokeWidth = card.strokeWidth ?? 2
        break
      case 'label':
        card.text = card.text ?? ''
        card.color = card.color ?? '#5b9bd5'
        card.backgroundColor = card.backgroundColor ?? 'rgba(91,155,213,0.08)'
        card.height = 'auto'
        break
      case 'spec':
        card.width = card.width ?? 220
        card.height = 'auto'
        card.sectionTitle = card.sectionTitle ?? ''
        card.specData = card.specData ?? null
        break
    }

    set(state => ({ cards: [...state.cards, card], hasUnsavedChanges: true }))
    return id
  },

  /**
   * Update a single card's properties.
   */
  updateCard: (id, updates) => {
    get()._pushHistory()
    set(state => ({
      cards: state.cards.map(c => (c.id === id ? { ...c, ...updates } : c)),
      hasUnsavedChanges: true,
    }))
  },

  /**
   * Batch-update multiple cards at once (for drag, alignment, etc.)
   * NOTE: Does NOT push history itself — drag caller handles that.
   * @param {Record<string, object>} updatesMap - { cardId: { x, y, ... } }
   */
  batchUpdateCards: (updatesMap) => {
    set(state => ({
      cards: state.cards.map(c =>
        updatesMap[c.id] ? { ...c, ...updatesMap[c.id] } : c
      ),
      hasUnsavedChanges: true,
    }))
  },

  /**
   * Delete cards by ids.
   */
  deleteCards: (ids) => {
    get()._pushHistory()
    const idSet = new Set(Array.isArray(ids) ? ids : [ids])
    set(state => ({
      cards: state.cards.filter(c => !idSet.has(c.id)),
      hasUnsavedChanges: true,
    }))
    // Also clear selection for deleted cards
    const sel = get().selectedIds.filter(id => !idSet.has(id))
    set({ selectedIds: sel })
  },

  /**
   * Clear all cards from the canvas.
   */
  clearAll: () => {
    get()._pushHistory()
    set({ cards: [], selectedIds: [], hasUnsavedChanges: true })
  },

  /**
   * Bring cards to front (end of render array = highest z-index).
   */
  bringToFront: (ids) => {
    get()._pushHistory()
    const idSet = new Set(Array.isArray(ids) ? ids : [ids])
    set(state => {
      const front = state.cards.filter(c => idSet.has(c.id))
      const rest = state.cards.filter(c => !idSet.has(c.id))
      return { cards: [...rest, ...front], hasUnsavedChanges: true }
    })
  },

  /**
   * Send cards to back (start of render array = lowest z-index).
   */
  sendToBack: (ids) => {
    get()._pushHistory()
    const idSet = new Set(Array.isArray(ids) ? ids : [ids])
    set(state => {
      const back = state.cards.filter(c => idSet.has(c.id))
      const rest = state.cards.filter(c => !idSet.has(c.id))
      return { cards: [...back, ...rest], hasUnsavedChanges: true }
    })
  },

  /**
   * Group cards together.
   */
  groupCards: (ids) => {
    if (!ids || ids.length < 2) return
    get()._pushHistory()
    const groupId = `group_${nanoid()}`
    set(state => ({
      cards: state.cards.map(c =>
        ids.includes(c.id) ? { ...c, groupId } : c
      ),
      hasUnsavedChanges: true,
    }))
  },

  /**
   * Ungroup cards.
   */
  ungroupCards: (ids) => {
    get()._pushHistory()
    const idSet = new Set(ids)
    set(state => {
      const affectedGroupIds = new Set()
      state.cards.forEach(c => {
        if (idSet.has(c.id) && c.groupId) affectedGroupIds.add(c.groupId)
      })
      return {
        cards: state.cards.map(c =>
          affectedGroupIds.has(c.groupId) ? { ...c, groupId: null } : c
        ),
        hasUnsavedChanges: true,
      }
    })
  },

  /**
   * Align selected cards by type.
   * type: 'left'|'center-x'|'right'|'top'|'center-y'|'bottom'|'distribute-x'|'distribute-y'
   */
  alignCards: (ids, type) => {
    if (!ids || ids.length < 2) return
    get()._pushHistory()

    const { cards } = get()
    // Only align cards with numeric width/height (image, drawing, label)
    const selCards = cards.filter(
      c => ids.includes(c.id) && typeof c.width === 'number'
    )
    if (selCards.length < 2) return

    const bounds = selCards.map(c => getCardBounds(c))
    const updates = doAlign(bounds, type)

    if (Object.keys(updates).length > 0) {
      set(state => ({
        cards: state.cards.map(c =>
          updates[c.id] ? { ...c, ...updates[c.id] } : c
        ),
        hasUnsavedChanges: true,
      }))
    }
  },

  /**
   * Arrange image cards in a grid layout.
   * @param {string} mode - 'optimal'|'name'|'path'|'order'|'addition'|'random'
   * @param {string[]} [ids] - optional: only arrange specific card ids
   */
  arrangeCards: (mode = 'optimal', ids = null) => {
    const { cards } = get()
    let imageCards = cards.filter(c => c.type === 'image')

    if (ids) {
      const idSet = new Set(ids)
      imageCards = imageCards.filter(c => idSet.has(c.id))
    }

    if (imageCards.length <= 1) return
    get()._pushHistory()

    const updates = doArrange(imageCards, mode)

    set(state => ({
      cards: state.cards.map(c =>
        updates[c.id] ? { ...c, ...updates[c.id] } : c
      ),
      hasUnsavedChanges: true,
    }))
  },

  /**
   * Resize multiple image cards to a uniform dimension (PureRef-style auto-normalize).
   * No user input required — target value is auto-calculated from the selection.
   * @param {string[]} ids - Card ids to resize
   * @param {'width'|'height'|'size'} mode - Which dimension to unify
   */
  resizeImagesToUniform: (ids, mode) => {
    if (!ids || ids.length === 0) return
    get()._pushHistory()

    const { cards } = get()
    const targetCards = cards.filter(
      c => ids.includes(c.id) && c.type === 'image'
    )
    if (targetCards.length === 0) return

    // Compute target values based on mode (PureRef: average of selection)
    let targetValue
    if (mode === 'width') {
      targetValue = targetCards.reduce((sum, c) => sum + (c.width || 200), 0) / targetCards.length
    } else if (mode === 'height') {
      targetValue = targetCards.reduce((sum, c) => sum + (typeof c.height === 'number' ? c.height : 200), 0) / targetCards.length
    } else {
      // 'size' — unify longest edge (PureRef: average of max(width, height))
      // Preserves aspect ratio: scale = target / maxEdge
      targetValue = targetCards.reduce((sum, c) => {
        const w = c.width || 200
        const h = typeof c.height === 'number' ? c.height : 200
        return sum + Math.max(w, h)
      }, 0) / targetCards.length
    }
    targetValue = Math.max(1, targetValue)

    const updatesMap = {}
    targetCards.forEach(c => {
      // Prefer natural aspect ratio; fall back to current dimensions
      const naturalRatio = c.naturalWidth > 0 ? c.naturalHeight / c.naturalWidth : null
      const w = c.width || 200
      const h = typeof c.height === 'number' ? c.height : 200
      const ratio = naturalRatio ?? (w > 0 ? h / w : 0.91)
      let newW, newH

      if (mode === 'width') {
        newW = Math.round(targetValue)
        newH = Math.round(targetValue * ratio)
      } else if (mode === 'height') {
        newH = Math.round(targetValue)
        newW = Math.round(targetValue / (ratio || 0.91))
      } else { // 'size' — scale to average longest edge
        const maxEdge = Math.max(w, h)
        const scale = maxEdge > 0 ? targetValue / maxEdge : 1
        newW = Math.round(w * scale)
        newH = Math.round(h * scale)
      }

      updatesMap[c.id] = { width: newW, height: newH }
    })

    set(state => ({
      cards: state.cards.map(c =>
        updatesMap[c.id] ? { ...c, ...updatesMap[c.id] } : c
      ),
      hasUnsavedChanges: true,
    }))
  },
})
