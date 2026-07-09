/**
 * historySlice — undo/redo for card operations.
 *
 * Architecture:
 *   - past[]: stack of card snapshots (max 50)
 *   - future[]: stack for redo, cleared on any new action
 *   - _pushHistory(): called by cardSlice actions BEFORE mutating state
 *   - undo() / redo(): restore from snapshot stacks
 *   - clearHistory(): called on load/new project
 *
 * Snapshots are shallow: only card-level fields (no deep-clone of imageUrl base64).
 * This keeps memory usage reasonable even with 50+ snapshots.
 */

const MAX_HISTORY = 50

/** Fields to include in each snapshot (excludes transient/internal data) */
const SNAPSHOT_FIELDS = [
  'id', 'type', 'x', 'y', 'width', 'height', 'rotation',
  'zIndex', 'locked', 'groupId', 'opacity',
  'imageUrl', 'name', 'flipH', 'flipV',
  'text', 'svgPath', 'specData', 'sectionTitle',
  'strokeColor', 'strokeWidth',
  'color', 'backgroundColor',
  'note', 'fontSize', 'autoSize',
  'sourceUrl', 'sourceType',
]

function snapshotCards(cards) {
  return cards.map(c => {
    const snap = {}
    for (const key of SNAPSHOT_FIELDS) {
      if (key in c) snap[key] = c[key]
    }
    return snap
  })
}

export const createHistorySlice = (set, get) => ({
  past: [],
  future: [],

  /**
   * Push current cards state onto the history stack.
   * Called by cardSlice actions before mutating state.
   * Clears future (no redo after new action).
   */
  _pushHistory: () => {
    const { cards, past } = get()
    const snapshot = snapshotCards(cards)
    set(state => {
      const newPast = state.past.length >= MAX_HISTORY
        ? [...state.past.slice(1), snapshot]
        : [...state.past, snapshot]
      return { past: newPast, future: [] }
    })
  },

  /**
   * Undo: restore previous snapshot.
   * Current cards → future stack, past snapshot → cards.
   */
  undo: () => {
    const { past, cards, selectedIds } = get()
    if (past.length === 0) return

    const current = snapshotCards(cards)
    const snapshot = past[past.length - 1]
    const newPast = past.slice(0, -1)

    // Sync selection: keep only ids that exist in the restored snapshot
    const snapshotIds = new Set(snapshot.map(c => c.id))
    const newSelectedIds = selectedIds.filter(id => snapshotIds.has(id))

    set({
      cards: snapshot.map(c => ({ ...c })),
      past: newPast,
      future: [...get().future, current],
      selectedIds: newSelectedIds,
    })
  },

  /**
   * Redo: restore future snapshot.
   * Current cards → past stack, future snapshot → cards.
   */
  redo: () => {
    const { future, cards, selectedIds } = get()
    if (future.length === 0) return

    const current = snapshotCards(cards)
    const snapshot = future[future.length - 1]
    const newFuture = future.slice(0, -1)

    const snapshotIds = new Set(snapshot.map(c => c.id))
    const newSelectedIds = selectedIds.filter(id => snapshotIds.has(id))

    set({
      cards: snapshot.map(c => ({ ...c })),
      past: [...get().past, current],
      future: newFuture,
      selectedIds: newSelectedIds,
    })
  },

  /**
   * Clear all history (called on project load / new project).
   */
  clearHistory: () => set({ past: [], future: [] }),

  /** Whether undo is available */
  canUndo: () => get().past.length > 0,

  /** Whether redo is available */
  canRedo: () => get().future.length > 0,
})
