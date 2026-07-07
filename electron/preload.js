const { contextBridge, ipcRenderer } = require('electron')

// ═══════════════════════════════════════════════════════════════════════
// Preload-run injection: retrieve .moodboard content from main process
// via synchronous IPC (ipcRenderer.sendSync). The value is captured in a
// closure BEFORE contextBridge.exposeInMainWorld, then exposed via
// getInjectedMoodboard() so the renderer's isolated world can access it.
//
// Prior approach (setting window.__openMoodboardContent__ directly) was
// broken under contextIsolation: true — preload's window is isolated from
// the renderer's window. contextBridge is the only reliable bridge.
// ═══════════════════════════════════════════════════════════════════════
const ___injectedMoodboard = (() => {
  try {
    return ipcRenderer.sendSync('get-injected-moodboard')
  } catch (_) {
    return null
  }
})()

contextBridge.exposeInMainWorld('electronAPI', {
  /** Whether running inside Electron */
  isElectron: true,

  /**
   * Get the .moodboard file content injected by the main process on launch.
   * Returns null if no file was injected (normal startup).
   * @returns {{ content: string, filePath: string } | null}
   */
  getInjectedMoodboard: () => ___injectedMoodboard,

  /**
   * Open native save dialog and save a .moodboard project file.
   * @param {ArrayBuffer} buffer - File data
   * @param {string} defaultName - Suggested file name
   * @returns {Promise<{filePath: string}|null>}
   */
  saveProject: (buffer, defaultName) =>
    ipcRenderer.invoke('dialog:saveProject', { buffer, defaultName }),

  /**
   * Open native save dialog and save an image file.
   * @param {ArrayBuffer} buffer - File data
   * @param {string} defaultName - Suggested file name
   * @returns {Promise<{filePath: string}|null>}
   */
  saveFile: (buffer, defaultName) =>
    ipcRenderer.invoke('dialog:saveFile', { buffer, defaultName }),

  /**
   * Write file directly to disk without showing a save dialog.
   * Used for batch export auto-naming (first image uses dialog, rest use this).
   * @param {string} filePath - Absolute path to write to
   * @param {ArrayBuffer} buffer - File data
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  writeFile: (filePath, buffer) =>
    ipcRenderer.invoke('writeFile', { filePath, buffer }),

  /**
   * Get the file path from a File object (Electron exposes .path on File).
   * @param {File} file
   * @returns {string|null}
   */
  getFilePath: (file) => file.path || null,

  /**
   * Toggle window always-on-top.
   * @param {boolean} flag - true to pin on top, false to unpin
   * @returns {Promise<boolean>} new always-on-top state
   */
  setAlwaysOnTop: (flag) =>
    ipcRenderer.invoke('window:setAlwaysOnTop', flag),

  /**
   * Get current always-on-top state.
   * @returns {Promise<boolean>}
   */
  isAlwaysOnTop: () =>
    ipcRenderer.invoke('window:isAlwaysOnTop'),

  /**
   * Window controls for custom title bar (frameless window).
   */
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  /**
   * Read a local file's contents (for .moodboard open-from-desktop).
   * @param {string} filePath - Absolute path to the file
   * @returns {Promise<{success: boolean, data?: number[], error?: string}>}
   */
  readFile: (filePath) =>
    ipcRenderer.invoke('dialog:readFile', filePath),

  /**
   * Listen for main process request to show the close dialog.
   * @param {Function} callback - Called when main wants renderer to show dialog
   */
  onCloseDialog: (callback) => {
    ipcRenderer.on('show-close-dialog', callback)
  },

  /**
   * Send close dialog response back to main process.
   * @param {'save'|'discard'|'cancel'} response
   */
  sendCloseDialogResponse: (response) => {
    ipcRenderer.send('close-dialog-response', response)
  },

  /**
   * Encrypt a string using Electron safeStorage.
   * Returns { success: boolean, data?: string, error?: string }
   * @param {string} plaintext
   * @returns {Promise<{success: boolean, data?: string, error?: string}>}
   */
  encryptString: (plaintext) =>
    ipcRenderer.invoke('safe-encrypt', plaintext),

  /**
   * Decrypt a string using Electron safeStorage.
   * @param {string} encryptedBase64
   * @returns {Promise<{success: boolean, data?: string, error?: string}>}
   */
  decryptString: (encryptedBase64) =>
    ipcRenderer.invoke('safe-decrypt', encryptedBase64),

  /**
   * Check whether safeStorage encryption is available on this system.
   * @returns {Promise<boolean>}
   */
  isEncryptionAvailable: () =>
    ipcRenderer.invoke('safe-is-available'),
})
