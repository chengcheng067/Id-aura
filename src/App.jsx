import { useState, useEffect, useRef, useCallback } from 'react'
import {
  GripVertical,
} from 'lucide-react'
import useStore from './store/useStore'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import SidePanel from './components/SidePanel'
import AiPanel from './components/AiPanel'
import FloatingAiButton from './components/FloatingAiButton'
import ResizeHandle from './components/ResizeHandle'
import SettingsModal from './components/SettingsModal'
import WelcomePage from './components/WelcomePage'
import CloseDialog from './components/CloseDialog'

/** Extract filename from a full path (Node-style or Windows-style). */
function basename(filePath) {
  return filePath.replace(/^.*[\\/]/, '')
}

/** Check whether the currently focused element is a text input. */
function isInputFocused() {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

/**
 * App root — lean layout shell with v2.7 startup/ settings/ welcome flow.
 *
 * Architecture: All state lives in the Zustand store.
 * App only does: layout, keyboard shortcuts, clipboard paste, file upload routing,
 * welcome page, settings modal, startup flow.
 * No useState for cards/canvas/selection.
 */
export default function App() {
  // ─── Store reads (existing) ───────────────────────────────
  const showSidePanel = useStore((s) => s.showSidePanel)
  const isAiPanelOpen = useStore((s) => s.isAiPanelOpen)
  const aiPanelWidth = useStore((s) => s.aiPanelWidth)
  const drawMode = useStore((s) => s.drawMode)
  const setDrawMode = useStore((s) => s.setDrawMode)
  const selectedIds = useStore((s) => s.selectedIds)
  const deleteCards = useStore((s) => s.deleteCards)
  const groupCards = useStore((s) => s.groupCards)
  const ungroupCards = useStore((s) => s.ungroupCards)
  const addCard = useStore((s) => s.addCard)
  const initFromAutoSave = useStore((s) => s.initFromAutoSave)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const exitGroupEdit = useStore((s) => s.exitGroupEdit)
  const editingGroupId = useStore((s) => s.editingGroupId)
  const clearAll = useStore((s) => s.clearAll)
  const recentFiles = useStore((s) => s.recentFiles)

  // ─── v2.7 new state ───────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [welcomeResolved, setWelcomeResolved] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  // ── Toolbar collapse / draggable logo ball state ─────
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [ballPos, setBallPos] = useState({ x: null, y: null }) // null = auto position
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 })

  const fileInputRef = useRef(null)
  const fileLoadRef = useRef(null)
  const lastMousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const canvasWrapRef = useRef(null)

  // Draggable logo ball ref (when toolbar collapsed)
  const ballRef = useRef(null)

  // Floating panel layout refs / state
  const toolbarWrapRef = useRef(null)
  const sidePanelWrapRef = useRef(null)
  const [sidePanelTop, setSidePanelTop] = useState(12)
  const [sidePanelWidth, setSidePanelWidth] = useState(300)
  const [toolbarWidth, setToolbarWidth] = useState(null)

  // ─── Startup flow ─────────────────────────────────────────
  useEffect(() => {
    const store = useStore.getState()

    // Load persisted settings (v2.7)
    store.loadSettings()

    // Decrypt API key if stored encrypted (v2.7.8 safeStorage)
    store.decryptStoredApiKey()

    // ════════════════════════════════════════════════════════════
    // Preload-injected .moodboard content (via contextBridge)
    // Main process reads file BEFORE React mounts and stores it.
    // Preload retrieves via sync IPC, exposes via electronAPI.
    // This is the ONLY reliable path under contextIsolation: true.
    // ════════════════════════════════════════════════════════════
    const injected = window.electronAPI?.getInjectedMoodboard?.()
    if (injected?.content) {
      const blob = new Blob([injected.content], { type: 'application/json' })
      const fileName = injected.filePath ? basename(injected.filePath) : 'project.moodboard'
      const file = new File([blob], fileName, { type: 'application/json' })
      store.loadProject(file)
      setWelcomeResolved(true)
      return // Skip normal startup flow
    }

    const { startupBehavior } = store.settings.file
    const { skipWelcome } = store.settings.display

    if (startupBehavior === 'welcome' && !skipWelcome) {
      setShowWelcome(true)
      // welcomeResolved stays false until user picks an action
    } else if (startupBehavior === 'last') {
      initFromAutoSave()
      setWelcomeResolved(true)
    } else {
      // 'new' — empty canvas
      setWelcomeResolved(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Welcome page callbacks ───────────────────────────────
  const handleNewProject = useCallback(() => {
    clearAll()
    setWelcomeResolved(true)
    setShowWelcome(false)
  }, [clearAll])

  const handleContinue = useCallback(() => {
    initFromAutoSave()
    setWelcomeResolved(true)
    setShowWelcome(false)
  }, [initFromAutoSave])

  const handleOpenFile = useCallback(() => {
    fileLoadRef.current?.click()
    // The file input onChange in the JSX will call loadProject and handle
    // the rest. We resolve immediately so the welcome page goes away.
    setWelcomeResolved(true)
    setShowWelcome(false)
  }, [])

  // ─── Dynamic auto-save from settings ──────────────────────
  const autoSave = useStore((s) => s.autoSave)
  const autoSaveInterval = useStore((s) => s.settings?.file?.autoSaveInterval)

  useEffect(() => {
    const interval = autoSaveInterval ?? 30000
    if (interval === 0 || interval === 'off') return
    const timer = setInterval(() => {
      autoSave()
    }, interval)
    return () => clearInterval(timer)
  }, [autoSaveInterval, autoSave])

  // ─── Auto layout avoidance: SidePanel dodges wrapped Toolbar ──
  useEffect(() => {
    if (toolbarCollapsed) {
      setSidePanelTop(12)
      return
    }
    const toolbarEl = toolbarWrapRef.current
    if (!toolbarEl) return

    const recalc = () => {
      const toolbarRect = toolbarEl.getBoundingClientRect()
      const sidePanelLeft = 12
      const sidePanelRight = sidePanelLeft + sidePanelWidth
      const toolbarLeft = toolbarRect.left
      const toolbarRight = toolbarRect.right
      const horizontalOverlap = toolbarLeft < sidePanelRight && toolbarRight > sidePanelLeft
      if (horizontalOverlap) {
        setSidePanelTop(Math.max(12, toolbarRect.bottom + 12))
      } else {
        setSidePanelTop(12)
      }
    }

    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(toolbarEl)
    window.addEventListener('resize', recalc)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recalc)
    }
  }, [toolbarCollapsed, sidePanelWidth])

  // ─── Collapsible toolbar → draggable logo ball ──────────────
  // Click the ball to re-expand; drag it to reposition freely.
  const startBallDrag = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = ballRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      w: rect.width,
      h: rect.height,
    }
    const onMove = (ev) => {
      const d = dragRef.current
      if (!d.dragging) return
      const dx = ev.clientX - d.startX
      const dy = ev.clientY - d.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
      const maxX = window.innerWidth - d.w - 8
      const maxY = window.innerHeight - d.h - 8
      const newX = Math.min(Math.max(d.origX + dx, 8), maxX)
      const newY = Math.min(Math.max(d.origY + dy, 8), maxY)
      setBallPos({ x: newX, y: newY })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const d = dragRef.current
      d.dragging = false
      // Treat as a click (expand) only if the pointer barely moved.
      if (!d.moved) setToolbarCollapsed(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ─── Electron bridge: expose callbacks for main process ────────
  // These are called by main.js via executeJavaScript, which runs in the
  // renderer's isolated world — the same world React lives in. Under
  // contextIsolation: true, executeJavaScript has access to window globals
  // set by React (unlike preload.js assignments which are isolated).
  useEffect(() => {
    window.__hasCards__ = () => {
      const state = useStore.getState()
      return state.cards && state.cards.length > 0
    }
    window.__saveProject__ = async () => {
      const state = useStore.getState()
      await state.saveProject()
    }
    window.__showCloseDialog__ = () => {
      // Only show close dialog if there are cards (unsaved work).
      // If no cards, close silently without prompt (B3 fix).
      const cards = useStore.getState().cards
      if (!cards || cards.length === 0) {
        window.electronAPI?.sendCloseDialogResponse?.('discard')
      } else {
        setShowCloseConfirm(true)
      }
    }
    /**
     * Load a .moodboard project from raw content string.
     * Called by main.js via executeJavaScript for:
     *   - second-instance (double-click .moodboard while app is running)
     *   - open-file event (macOS re-open)
     * Skips the welcome page and loads directly into the canvas.
     * @param {string} content - Raw JSON content of the .moodboard file
     * @param {string} filePath - Absolute file path of the .moodboard file
     */
    window.__loadMoodboardContent__ = (content, filePath) => {
      if (!content) return
      const blob = new Blob([content], { type: 'application/json' })
      const fileName = filePath ? basename(filePath) : 'project.moodboard'
      const file = new File([blob], fileName, { type: 'application/json' })
      useStore.getState().loadProject(file)
    }

    // Listen for main process IPC 'show-close-dialog' event
    window.electronAPI?.onCloseDialog?.(() => setShowCloseConfirm(true))

    return () => {
      delete window.__hasCards__
      delete window.__saveProject__
      delete window.__showCloseDialog__
      delete window.__loadMoodboardContent__
    }
  }, [])

  // ─── Track last mouse position so pasted images land near the cursor ──
  useEffect(() => {
    const handleMouseMove = (e) => {
      lastMousePos.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // ─── Keyboard shortcuts ───────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      // Ctrl+, — toggle settings panel
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setShowSettings((prev) => !prev)
        return
      }

      // Esc exits draw mode or group-edit mode
      if (e.key === 'Escape') {
        if (drawMode) {
          setDrawMode(false)
          return
        }
        if (editingGroupId) {
          exitGroupEdit()
          return
        }
      }

      // Ctrl+S save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        useStore.getState().saveProject()
        return
      }

      // Ctrl+O open
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        fileLoadRef.current?.click()
        return
      }

      // Ctrl+V paste — only intercept when no input is focused
      if (e.ctrlKey && e.key === 'v') {
        if (isInputFocused()) return // let input/textarea handle default paste
        e.preventDefault()
        pasteFromClipboard(addCard, lastMousePos.current, canvasWrapRef)
        return
      }

      // Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && !drawMode && selectedIds.length > 0) {
        e.preventDefault()
        deleteCards(selectedIds)
        return
      }

      // Ctrl+G group
      if (e.ctrlKey && e.key === 'g' && !e.shiftKey) {
        e.preventDefault()
        if (selectedIds.length >= 2) groupCards(selectedIds)
        return
      }

      // Ctrl+Shift+Z redo
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        redo()
        return
      }

      // Ctrl+Z undo (must come after Ctrl+Shift+Z check)
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      // Ctrl+Shift+G ungroup
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault()
        if (selectedIds.length > 0) ungroupCards(selectedIds)
        return
      }
    },
    [drawMode, setDrawMode, selectedIds, deleteCards, groupCards, ungroupCards, addCard, undo, redo, editingGroupId, exitGroupEdit],
  )

  // ─── Welcome page ─────────────────────────────────────────
  if (!welcomeResolved) {
    return (
      <>
        <WelcomePage
          onNewProject={handleNewProject}
          onContinue={handleContinue}
          onOpenFile={handleOpenFile}
          recentFiles={recentFiles}
        />
        {/* Hidden file inputs — must be mounted so onOpenFile can click them */}
        <input
          ref={fileLoadRef}
          type="file"
          accept=".moodboard"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files.length > 0) {
              useStore.getState().loadProject(e.target.files[0])
              e.target.value = ''
            }
          }}
        />
      </>
    )
  }

  // ─── Main interface ───────────────────────────────────────
  // Canvas fills the entire window; Toolbar/SidePanel/AiPanel float as tiles.
  return (
    <div
      className="transition-fast"
      style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Full-bleed canvas background */}
      <div ref={canvasWrapRef} data-canvas-container style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Canvas onSettingsClick={() => setShowSettings(true)} />
      </div>

      {/* Floating Toolbar */}
      {toolbarCollapsed ? (
        <div
          ref={ballRef}
          onMouseDown={startBallDrag}
          title="点击展开工具栏 · 可拖动到任意位置"
          style={{
            position: 'fixed',
            top: ballPos.x == null ? 12 : ballPos.y,
            left: ballPos.x == null ? 'auto' : ballPos.x,
            right: ballPos.x == null ? 12 : 'auto',
            width: 44,
            height: 44,
            borderRadius: '50%',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-gradient)',
            boxShadow: '0 0 18px rgba(124,58,237,0.55), 0 4px 14px rgba(0,0,0,0.45)',
            border: '2px solid rgba(255,255,255,0.18)',
            zIndex: 200,
            userSelect: 'none',
            transition: 'transform 160ms ease-out, box-shadow 160ms ease-out',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <img src="./assets/icon.png" alt="ID Aura" style={{ width: 26, height: 26, borderRadius: 6, pointerEvents: 'none' }} />
        </div>
      ) : (
        <div ref={toolbarWrapRef} style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: toolbarWidth ?? 'auto', maxWidth: 'calc(100% - 24px)', minWidth: 280 }}>
          <Toolbar
            fileLoadRef={fileLoadRef}
            fileInputRef={fileInputRef}
            onSettingsClick={() => setShowSettings(true)}
            onCollapse={() => setToolbarCollapsed(true)}
          />
          <ToolbarResizeHandle onResize={(dx) => setToolbarWidth((w) => {
            const current = w ?? toolbarWrapRef.current?.getBoundingClientRect().width ?? 600
            return Math.min(Math.max(current - dx * 2, 320), window.innerWidth - 48)
          })} />
        </div>
      )}

      {/* Floating SidePanel */}
      {showSidePanel && (
        <div ref={sidePanelWrapRef} style={{ position: 'absolute', top: sidePanelTop, left: 12, bottom: 12, width: sidePanelWidth, zIndex: 100 }}>
          <SidePanel />
          <SidePanelResizeHandle onResize={(dx) => setSidePanelWidth((w) => Math.min(Math.max(w - dx, 220), 450))} />
        </div>
      )}

      {/* Floating AI Panel */}
      {isAiPanelOpen && (
        <div style={{ position: 'absolute', top: 12, right: 12, bottom: 12, width: aiPanelWidth, zIndex: 100 }}>
          <AiPanel />
          <ResizeHandle />
        </div>
      )}

      {/* Floating AI Button */}
      <FloatingAiButton />

      {/* Settings modal */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files.length > 0) {
            Array.from(e.target.files).forEach((file) => {
              if (file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file)
                const sourceUrl = (window.electronAPI && window.electronAPI.getFilePath)
                  ? window.electronAPI.getFilePath(file) || file.name
                  : file.name
                addCard('image', { imageUrl: url, name: file.name, sourceUrl, sourceType: 'local' })
              }
            })
            e.target.value = ''
          }
        }}
      />
      <input
        ref={fileLoadRef}
        type="file"
        accept=".moodboard"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files.length > 0) {
            useStore.getState().loadProject(e.target.files[0])
            e.target.value = ''
          }
        }}
      />

      {/* Close confirmation dialog */}
      {showCloseConfirm && (
        <CloseDialog
          onCancel={() => {
            setShowCloseConfirm(false)
            window.electronAPI?.sendCloseDialogResponse?.('cancel')
          }}
          onDiscard={() => {
            window.electronAPI?.sendCloseDialogResponse?.('discard')
          }}
          onSave={async () => {
            await useStore.getState().saveProject()
            window.electronAPI?.sendCloseDialogResponse?.('save')
          }}
        />
      )}
    </div>
  )
}

/** Right-edge resize handle for the floating Toolbar (changes width symmetrically because centered). */
function ToolbarResizeHandle({ onResize }) {
  const isResizing = useRef(false)
  const startX = useRef(0)

  const handleMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true
    startX.current = e.clientX

    const handleMouseMove = (ev) => {
      if (!isResizing.current) return
      const dx = startX.current - ev.clientX
      startX.current = ev.clientX
      onResize(dx)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        right: -3,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: 'col-resize',
        zIndex: 10,
        background: 'transparent',
        transition: 'background 150ms ease-out',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-default)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    />
  )
}

/** Right-edge resize handle for the floating SidePanel. */
function SidePanelResizeHandle({ onResize }) {
  const isResizing = useRef(false)
  const startX = useRef(0)

  const handleMouseDown = (e) => {
    e.preventDefault()
    isResizing.current = true
    startX.current = e.clientX

    const handleMouseMove = (ev) => {
      if (!isResizing.current) return
      const dx = startX.current - ev.clientX
      startX.current = ev.clientX
      onResize(dx)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: 'col-resize',
        zIndex: 10,
        background: 'transparent',
        transition: 'background 150ms ease-out',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-default)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    />
  )
}

/** Attempt to paste an image from clipboard near the current mouse position. */
async function pasteFromClipboard(addCard, mousePos, canvasWrapRef) {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type)
          const url = URL.createObjectURL(blob)

          // Convert screen mouse position to canvas coordinates using the
          // actual canvas container bounds (accounts for toolbar height and sidebars).
          const store = useStore.getState()
          const { canvas } = store
          const rect = canvasWrapRef?.current?.getBoundingClientRect()

          const canvasX = rect
            ? (mousePos.x - rect.left - canvas.offsetX) / canvas.scale
            : (mousePos.x - canvas.offsetX) / canvas.scale
          const canvasY = rect
            ? (mousePos.y - rect.top - canvas.offsetY) / canvas.scale
            : (mousePos.y - canvas.offsetY) / canvas.scale

          // Default card size (will be adjusted on image load)
          const defaultW = 220
          const defaultH = 200

          addCard('image', {
            imageUrl: url,
            name: '剪贴板图片',
            sourceType: 'clipboard',
            x: Math.round(canvasX - defaultW / 2),
            y: Math.round(canvasY - defaultH / 2),
          })
          return
        }
      }
    }
    alert('剪贴板中没有图片')
  } catch {
    alert('无法读取剪贴板，请尝试直接 Ctrl+V')
  }
}
