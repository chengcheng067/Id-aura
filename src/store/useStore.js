import { create } from 'zustand'
import { createCardSlice } from './cardSlice'
import { createSelectionSlice } from './selectionSlice'
import { createCanvasSlice } from './canvasSlice'
import { createProjectSlice } from './projectSlice'
import { createHistorySlice } from './historySlice'
import { createSettingsSlice } from './settingsSlice'
import { createChatSlice } from './chatSlice'

/**
 * The single Zustand store combining all six slices.
 *
 * Architecture principle:
 *   State flows UP (all in store), commands flow DOWN (store actions),
 *   events flow UP (components dispatch through store).
 *
 * Components should NOT use local useState for canvas/card/selection state.
 * They read from this store and call store actions to mutate.
 */
const useStore = create((set, get) => ({
  ...createCardSlice(set, get),
  ...createSelectionSlice(set, get),
  ...createCanvasSlice(set, get),
  ...createProjectSlice(set, get),
  ...createHistorySlice(set, get),
  ...createSettingsSlice(set, get),
  ...createChatSlice(set, get),
}))

export default useStore
