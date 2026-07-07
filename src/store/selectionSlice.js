/**
 * Selection slice: manages which cards are currently selected.
 */
export const createSelectionSlice = (set, get) => ({
  selectedIds: [],

  /** When non-null, we're in "group edit" mode for this group. */
  editingGroupId: null,

  /**
   * Enter group-edit mode for the given group.
   * Only cards in this group are interactive; others are dimmed.
   */
  enterGroupEdit: (groupId) => {
    if (!groupId) return
    set({ editingGroupId: groupId, selectedIds: [] })
  },

  /**
   * Exit group-edit mode.
   */
  exitGroupEdit: () => {
    set({ editingGroupId: null, selectedIds: [] })
  },

  /**
   * Select a single card with the given mode.
   * - 'single': replace selection with this card only
   * - 'toggle': toggle this card in/out of current selection
   * - 'add': add this card to current selection (no-op if already selected)
   */
  selectCard: (id, mode = 'single') => {
    set(state => {
      let next
      switch (mode) {
        case 'single':
          next = [id]
          break
        case 'toggle':
          next = state.selectedIds.includes(id)
            ? state.selectedIds.filter(i => i !== id)
            : [...state.selectedIds, id]
          break
        case 'add':
          next = state.selectedIds.includes(id)
            ? state.selectedIds
            : [...state.selectedIds, id]
          break
        default:
          next = [id]
      }
      return { selectedIds: next }
    })
  },

  /**
   * Select multiple cards at once.
   * - 'set': replace selection
   * - 'box': replace with given ids (box-select result)
   * - 'clear': deselect all
   */
  selectCards: (ids, mode = 'set') => {
    switch (mode) {
      case 'box':
        set({ selectedIds: [...ids] })
        break
      case 'clear':
        set({ selectedIds: [] })
        break
      case 'set':
      default:
        set({ selectedIds: [...ids] })
        break
    }
  },

  /**
   * Deselect all cards.
   */
  clearSelection: () => {
    set({ selectedIds: [] })
  },

  /**
   * Remove specific ids from the selection.
   */
  clearSelectionForIds: (ids) => {
    const idSet = new Set(Array.isArray(ids) ? ids : [ids])
    set(state => ({
      selectedIds: state.selectedIds.filter(id => !idSet.has(id)),
    }))
  },
})
