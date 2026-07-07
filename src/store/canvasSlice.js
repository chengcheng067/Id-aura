/**
 * Canvas state slice: manages zoom, pan, grid, and focus.
 */
export const createCanvasSlice = (set, get) => ({
  canvas: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    gridType: 'dots',
    locked: false,
  },

  /**
   * Set canvas scale (clamped to 0.1–5).
   */
  setScale: (scale) => {
    set(state => ({
      canvas: { ...state.canvas, scale: Math.min(Math.max(scale, 0.1), 5) },
    }))
  },

  /**
   * Set canvas offset (pan position).
   */
  setOffset: (x, y) => {
    set(state => ({
      canvas: { ...state.canvas, offsetX: x, offsetY: y },
    }))
  },

  /**
   * Update multiple canvas properties at once.
   */
  updateCanvas: (updates) => {
    set(state => ({
      canvas: { ...state.canvas, ...updates },
    }))
  },

  /**
   * Reset zoom to 100% and pan to origin.
   */
  resetView: () => {
    set(state => ({
      canvas: { ...state.canvas, scale: 1, offsetX: 0, offsetY: 0 },
    }))
  },

  /**
   * Auto-fit: zoom and pan to show all cards centered.
   */
  focusAll: () => {
    const { cards, showSidePanel, isAiPanelOpen, aiPanelWidth } = get()
    if (cards.length === 0) {
      set(state => ({
        canvas: { ...state.canvas, scale: 1, offsetX: 0, offsetY: 0 },
      }))
      return
    }

    // Calculate bounding box of all cards
    const xs = []
    const ys = []
    cards.forEach(c => {
      const w = typeof c.width === 'number' ? c.width : 220
      const h = typeof c.height === 'number' ? c.height : 200
      xs.push(c.x, c.x + w)
      ys.push(c.y, c.y + h)
    })

    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    const contentW = maxX - minX + 100 // padding
    const contentH = maxY - minY + 100

    // We need a container ref for viewport dimensions — use a reasonable default
    const sidebarTotalWidth = (showSidePanel ? 300 : 0) + (isAiPanelOpen ? aiPanelWidth : 0) + 24
    const vw = window.innerWidth - sidebarTotalWidth
    const vh = window.innerHeight - 100

    const scaleX = vw / contentW
    const scaleY = vh / contentH
    const newScale = Math.min(scaleX, scaleY, 2) // cap at 200%

    const offsetX = vw / 2 - (minX + contentW / 2 - 50) * newScale
    const offsetY = vh / 2 - (minY + contentH / 2 - 50) * newScale

    set(state => ({
      canvas: {
        ...state.canvas,
        scale: newScale,
        offsetX,
        offsetY,
      },
    }))
  },

  /**
   * Convert screen coordinates to canvas coordinates.
   * (Utility — components should call this via the store or compute locally.)
   */
  screenToCanvas: (clientX, clientY, containerRect) => {
    const { canvas } = get()
    return {
      x: (clientX - containerRect.left - canvas.offsetX) / canvas.scale,
      y: (clientY - containerRect.top - canvas.offsetY) / canvas.scale,
    }
  },
})
