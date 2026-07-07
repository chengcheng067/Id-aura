const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow = null
let fileToOpen = null
let injectedMoodboard = null
let forceQuitting = false
let closeDialogPending = false

// ─── Helper: executeJavaScript with timeout ───────────────────
// Wraps webContents.executeJavaScript with a timeout to prevent
// the window from being stuck if the renderer doesn't respond.
function executeJSWithTimeout(webContents, script, timeoutMs = 3000) {
  return Promise.race([
    webContents.executeJavaScript(script),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`executeJavaScript timeout (${timeoutMs}ms)`)), timeoutMs)
    ),
  ])
}

// ─── Helper: find a .moodboard path in an argv-like array ──────────────
function findMoodboardPath(args) {
  if (!Array.isArray(args)) return null
  for (const raw of args) {
    const arg = (raw || '').replace(/^["']|["']$/g, '')
    if (arg.endsWith('.moodboard') && arg.length > '.moodboard'.length) {
      return arg
    }
  }
  return null
}

// ─── Helper: forward an opened file to the renderer ────────────────────
// Calls the renderer-side __loadMoodboardContent__ global function which
// was registered by App.jsx during mount. This function exists in the
// renderer's isolated world, so executeJavaScript can reach it (unlike
// direct window property assignments which fail under contextIsolation).
function forwardOpenFile(filePath) {
  if (!filePath) return
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    let content = null
    try { content = fs.readFileSync(filePath, 'utf-8') } catch (_) { /* ignore */ }
    mainWindow.webContents.executeJavaScript(
      `window.__loadMoodboardContent__(${JSON.stringify(content || '')}, ${JSON.stringify(filePath)})`
    )
  } else {
    fileToOpen = filePath
  }
}

// Single-instance lock — required for second-instance event
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

function createWindow() {
  // ── Preload injection: store file content for preload to retrieve via IPC ──
  if (fileToOpen) {
    try {
      const content = fs.readFileSync(fileToOpen, 'utf-8')
      injectedMoodboard = { content, filePath: fileToOpen }
    } catch (_) { /* fall through — renderer fallback handles */ }
    fileToOpen = null
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 200,
    minHeight: 150,
    title: 'ID Aura',
    icon: path.join(__dirname, '../public/assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  })

  Menu.setApplicationMenu(null)

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3005')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })

  // Handle close: ask renderer to show the custom React close dialog.
  // forceQuitting flag prevents destroy() from re-triggering the close event.
  // closeDialogPending prevents re-entry if user clicks X multiple times fast.
  //
  // !!CRITICAL: do NOT use async/await here. Electron's close event requires
  // e.preventDefault() to be called SYNCHRONOUSLY to block window closing.
  // With async, the await yields control back to the event loop, the window
  // closes, and the subsequent preventDefault() is a no-op.
  //
  // If executeJavaScript fails (e.g. renderer not mounted, error in callback),
  // we fall back to forceQuitting + destroy() so the window doesn't get stuck.
  mainWindow.on('close', (e) => {
    if (forceQuitting) return
    if (closeDialogPending) return // already showing dialog, ignore repeated clicks
    closeDialogPending = true

    // Prevent close immediately — must be synchronous
    e.preventDefault()

    // Ask renderer to show the custom close dialog (React component).
    // With retry + timeout + native dialog fallback:
    //   1st attempt: executeJavaScript with 3s timeout
    //   2nd attempt: after 500ms delay, retry with 3s timeout
    //   Final fallback: native dialog.showMessageBox
    executeJSWithTimeout(mainWindow.webContents, 'window.__showCloseDialog__?.()')
      .catch(() => {
        // Retry once after 500ms
        return new Promise((resolve) => setTimeout(resolve, 500))
          .then(() => executeJSWithTimeout(mainWindow.webContents, 'window.__showCloseDialog__?.()'))
      })
      .catch(async () => {
        // Both attempts failed — show native dialog as ultimate fallback
        closeDialogPending = false
        try {
          const { response } = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['取消', '不保存并关闭', '保存并关闭'],
            defaultId: 2,
            cancelId: 0,
            title: 'ID Aura',
            message: '是否保存当前项目？',
            detail: '当前项目包含未保存的更改。选择保存后再关闭，以避免丢失工作内容。',
          })
          if (response === 0) return // cancel
          if (response === 1) {
            // Discard
            forceQuitting = true
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
          } else if (response === 2) {
            // Save & close — execute save via executeJavaScript then close
            await mainWindow.webContents.executeJavaScript('window.__saveProject__?.()').catch(() => {})
            forceQuitting = true
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
          }
        } catch {
          // If even native dialog fails, force close
          closeDialogPending = false
          forceQuitting = true
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
        }
      })
  })
}

app.whenReady().then(() => {
  // ─── IPC: inject .moodboard content into preload synchronously ────
  ipcMain.on('get-injected-moodboard', (e) => {
    e.returnValue = injectedMoodboard || null
    injectedMoodboard = null
  })

  // Register .moodboard file association in Windows registry (HKCU, no admin needed)
  if (process.platform === 'win32') {
    const { execSync } = require('child_process')
    const exePath = process.execPath
    const progId = 'IDAuraMoodboard'
    try {
      // Check if already registered
      execSync(`reg query "HKCU\\Software\\Classes\\\\.moodboard"`, { stdio: 'ignore' })
    } catch {
      // Not registered — create association
      try {
        execSync(`reg add "HKCU\\Software\\Classes\\\\.moodboard" /ve /d "${progId}" /f`, { stdio: 'ignore' })
        execSync(`reg add "HKCU\\Software\\Classes\\${progId}\\shell\\open\\command" /ve /d "\\"${exePath}\\" \\"%1\\"" /f`, { stdio: 'ignore' })
      } catch (_) { /* ignore registry errors */ }
    }
  }

  // ─── Windows file association: read .moodboard from command-line args ──
  // On Windows, double-clicking a .moodboard file launches the exe with the
  // file path as a command-line argument (NOT via 'open-file' event, which is
  // macOS-only). We scan all argv entries and strip quotes to be robust.
  const fileArg = findMoodboardPath(process.argv)
  if (fileArg) {
    fileToOpen = fileArg
  }

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// --- IPC: Save .moodboard project file ---
ipcMain.handle('dialog:saveProject', async (event, { buffer, defaultName }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      { name: 'ID Aura 项目文件', extensions: ['moodboard'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, Buffer.from(buffer))
    return { filePath: result.filePath }
  }
  return null
})

// --- IPC: Direct file write (no dialog, for batch export auto-naming) ---
ipcMain.handle('writeFile', async (_event, { filePath, buffer }) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// --- IPC: Save file dialog (for image export) ---
ipcMain.handle('dialog:saveFile', async (event, { buffer, defaultName }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      { name: 'PNG 图片', extensions: ['png'] },
      { name: 'JPEG 图片', extensions: ['jpg', 'jpeg'] },
    ],
  })
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, Buffer.from(buffer))
    return { filePath: result.filePath }
  }
  return null
})

// --- IPC: Window always-on-top toggle ---
ipcMain.handle('window:setAlwaysOnTop', (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(flag)
    return mainWindow.isAlwaysOnTop()
  }
  return false
})

// --- IPC: Get always-on-top state ---
ipcMain.handle('window:isAlwaysOnTop', () => {
  return mainWindow ? mainWindow.isAlwaysOnTop() : false
})

// --- IPC: Read file content (for .moodboard open-from-desktop) ---
ipcMain.handle('dialog:readFile', async (_event, filePath) => {
  try {
    const data = fs.readFileSync(filePath)
    return { success: true, data: Array.from(new Uint8Array(data)) }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// --- File association: open-file event (macOS double-click / re-open) ---
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  forwardOpenFile(filePath)
})

// --- File association: second-instance (Windows re-open while running) ---
// Calls renderer-side __loadMoodboardContent__ via executeJavaScript, which
// runs in the renderer's isolated world and can reach functions registered
// by React (e.g., via window.__loadMoodboardContent__ set in App.jsx).
app.on('second-instance', (_event, commandLine) => {
  const filePath = findMoodboardPath(commandLine)
  if (filePath) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      let content = null
      try { content = fs.readFileSync(filePath, 'utf-8') } catch (_) { /* ignore */ }
      mainWindow.webContents.executeJavaScript(
        `window.__loadMoodboardContent__(${JSON.stringify(content || '')}, ${JSON.stringify(filePath)})`
      )
    } else {
      fileToOpen = filePath
    }
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus()
  }
})

// --- IPC: Close dialog response (from React renderer) ---
// SYNC handler — no async/await to avoid race conditions.
// The renderer saves BEFORE sending the response, so we don't need to
// call executeJavaScript('window.__saveProject__') here.
// 'cancel' → reset closeDialogPending so user can try again
// 'discard' → forceQuit + close
// 'save'   → forceQuit + close (save already happened in renderer)
ipcMain.on('close-dialog-response', (event, response) => {
  closeDialogPending = false
  if (response === 'cancel') return

  forceQuitting = true
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Use close() instead of destroy() — forceQuitting=true bypasses the
    // dialog handler, and close() allows normal window close behavior
    mainWindow.close()
  }
})

// --- IPC: Window controls (for custom title bar) ---
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize()
})
ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  }
})
ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close()
})
ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false
})

// --- IPC: safeStorage API Key encryption ---
// Uses Electron's safeStorage API (OS-level encryption) to protect
// the user's API key at rest in localStorage.
// encrypted data is returned as base64 string for JSON-safe storage.
ipcMain.handle('safe-encrypt', (_event, plaintext) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: '系统加密不可用' }
    }
    const encrypted = safeStorage.encryptString(plaintext)
    return { success: true, data: encrypted.toString('base64') }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('safe-decrypt', (_event, encryptedBase64) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: '系统加密不可用' }
    }
    const decrypted = safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64'))
    return { success: true, data: decrypted.toString() }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('safe-is-available', () => {
  return safeStorage.isEncryptionAvailable()
})
