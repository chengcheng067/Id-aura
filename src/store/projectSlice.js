import { nanoid } from 'nanoid'
import { serializeProject, deserializeProject, loadAutoSave, saveAutoSave } from '../utils/fileIO'

/**
 * Project slice: save/load, auto-save, custom specs, UI ephemeral state.
 */
export const createProjectSlice = (set, get) => ({
  customSpecs: [],
  saving: false,
  drawMode: false,
  drawColor: '#5b9bd5',
  showSidePanel: true,
  showImporter: false,
  hasUnsavedChanges: false,

  setDrawMode: (mode) => set({ drawMode: mode }),
  setDrawColor: (color) => set({ drawColor: color }),
  setSaving: (val) => set({ saving: val }),
  togglePanel: () => set(state => ({ showSidePanel: !state.showSidePanel })),
  toggleImporter: () => set(state => ({ showImporter: !state.showImporter })),

  /**
   * Add a user-defined custom spec.
   */
  addCustomSpec: (specData) => {
    const id = `custom_${nanoid()}`
    set(state => ({
      customSpecs: [...state.customSpecs, { id, ...specData }],
    }))
  },

  /**
   * Delete a custom spec by id.
   */
  deleteCustomSpec: (specId) => {
    set(state => ({
      customSpecs: state.customSpecs.filter(s => s.id !== specId),
    }))
  },

  /**
   * Save the project as a .moodboard file download.
   * Images are converted to base64 and embedded.
   * In Electron: uses native save dialog via IPC.
   * In browser: uses <a download> fallback.
   */
  saveProject: async () => {
    const { cards, canvas, customSpecs } = get()
    set({ saving: true })
    try {
      const blob = await serializeProject(cards, canvas, customSpecs)
      const defaultName = `ID_Aura_${new Date().toISOString().slice(0, 10)}.moodboard`

      if (window.electronAPI?.isElectron && window.electronAPI?.saveProject) {
        // Electron: use native save dialog (supports .moodboard filter)
        const buffer = await blob.arrayBuffer()
        const result = await window.electronAPI.saveProject(buffer, defaultName)
        if (result && result.filePath) {
          set({ hasUnsavedChanges: false })
        }
      } else {
        // Browser fallback: trigger download via <a> element
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        set({ hasUnsavedChanges: false })
      }
    } catch (err) {
      console.error('Save failed:', err)
      alert('保存失败: ' + err.message)
    }
    set({ saving: false })
  },

  /**
   * Load a .moodboard file and restore project state.
   * @param {File} file
   */
  loadProject: (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const project = deserializeProject(e.target.result)
        if (!project) throw new Error('格式无效')

        set({
          cards: project.cards,
          canvas: {
            scale: project.canvas?.scale ?? 1,
            offsetX: project.canvas?.offsetX ?? 0,
            offsetY: project.canvas?.offsetY ?? 0,
            gridType: project.canvas?.gridType ?? 'dots',
            locked: false,
          },
          customSpecs: project.customSpecs || [],
          selectedIds: [],
          hasUnsavedChanges: project.cards.length > 0,
        })
        // Clear undo history after loading a project
        get().clearHistory()
      } catch (err) {
        console.error('Load failed:', err)
        alert('文件格式错误或已损坏，请检查文件是否为 .moodboard 格式')
      }
    }
    reader.readAsText(file)
  },

  /**
   * Auto-save current state to localStorage (debounced by caller).
   * Also generates thumbnail and adds to recent files.
   */
  autoSave: () => {
    const { cards, canvas, customSpecs } = get()
    const safeCards = cards.map(card => {
      if (card.imageUrl && card.imageUrl.startsWith('blob:')) {
        return { ...card, imageUrl: null, _blobLost: true }
      }
      return card
    })
    saveAutoSave({ cards: safeCards, canvas, customSpecs })
    set({ hasUnsavedChanges: cards.length > 0 })

    // Generate thumbnail and add to recent files (async, non-blocking)
    if (cards.length > 0) {
      get().generateThumbnail().then((thumbnail) => {
        if (thumbnail) {
          get().addRecentFile({
            name: '自动保存',
            path: null,
            thumbnail,
            lastModified: Date.now(),
            cardCount: cards.length,
          })
        }
      })
    }
  },

  /**
   * Restore state from localStorage auto-save (called once on mount).
   */
  initFromAutoSave: () => {
    const saved = loadAutoSave()
    if (!saved) {
      set({ hasUnsavedChanges: false })
      return false
    }

    set({
      cards: saved.cards || [],
      canvas: {
        scale: saved.canvas?.scale ?? 1,
        offsetX: saved.canvas?.offsetX ?? 0,
        offsetY: saved.canvas?.offsetY ?? 0,
        gridType: 'dots',
        locked: false,
      },
      customSpecs: saved.customSpecs || [],
      selectedIds: [],
      hasUnsavedChanges: (saved.cards || []).length > 0,
    })
    // Clear undo history after restoring auto-save
    get().clearHistory()
    return true
  },
})
