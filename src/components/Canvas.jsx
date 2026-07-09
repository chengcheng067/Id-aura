import { useRef, useState, useCallback, useEffect } from 'react'
import useStore from '../store/useStore'
import { calcSnap, hitTest } from '../utils/geometry'
import CardNode from './CardNode'
import ContextMenu from './ContextMenu'
import ZoomControls from './ZoomControls'
import html2canvas from 'html2canvas'

/**
 * Canvas — pure rendering + event dispatch.
 *
 * Architecture:
 *   - Reads state from Zustand store (cards, canvas, selectedIds, drawMode)
 *   - Ephemeral mouse/drag state stays local (isPanning, dragStart, etc.)
 *   - All data mutations go through store actions
 */
export default function Canvas({ onSettingsClick }) {
  const containerRef = useRef(null)

  // --- Store reads ---
  const cards = useStore((s) => s.cards)
  const canvas = useStore((s) => s.canvas)
  const updateCanvas = useStore((s) => s.updateCanvas)
  const selectedIds = useStore((s) => s.selectedIds)
  const selectCards = useStore((s) => s.selectCards)
  const selectCard = useStore((s) => s.selectCard)
  const updateCard = useStore((s) => s.updateCard)
  const batchUpdateCards = useStore((s) => s.batchUpdateCards)
  const addCard = useStore((s) => s.addCard)
  const drawMode = useStore((s) => s.drawMode)
  const drawColor = useStore((s) => s.drawColor)
  const setDrawMode = useStore((s) => s.setDrawMode)
  const deleteCards = useStore((s) => s.deleteCards)
  const clearSelection = useStore((s) => s.clearSelection)
  const editingGroupId = useStore((s) => s.editingGroupId)
  const enterGroupEdit = useStore((s) => s.enterGroupEdit)
  const exitGroupEdit = useStore((s) => s.exitGroupEdit)
  const collapsedGroups = useStore((s) => s.collapsedGroups)
  const toggleGroupCollapsed = useStore((s) => s.toggleGroupCollapsed)

  // --- Ephemeral local state ---
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Refs for middle-click panning (capture phase — must bypass React batching)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })

  // Space-drag panning (PureRef/Figma muscle memory)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const spaceHeldRef = useRef(false)
  const panSourceRef = useRef(null) // 'space' | 'middle' | null

  // Mini reference window (simplified PureRef-style floating view)
  const miniOpenRef = useRef(false)
  const miniTimerRef = useRef(null)
  const miniSubRef = useRef(null)
  const [draggingCard, setDraggingCard] = useState(null)
  const [dragStart, setDragStart] = useState(null)
  const [resizing, setResizing] = useState(null)
  const [boxSelect, setBoxSelect] = useState(null)
  const [drawPath, setDrawPath] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [alignGuides, setAlignGuides] = useState(null)
  const [dragOverCanvas, setDragOverCanvas] = useState(false)
  const showImporter = useStore((s) => s.showImporter)
  const toggleImporter = useStore((s) => s.toggleImporter)
  const settings = useStore((s) => s.settings)

  // --- Dynamic canvas background from settings ---
  const canvasSettings = settings?.canvas || {}
  const pattern = canvasSettings.pattern || 'dots'
  const dotColor = `rgba(255, 255, 255, ${canvasSettings.bgOpacity ?? 0.05})`
  const lineColor = `rgba(255, 255, 255, ${canvasSettings.bgOpacity ?? 0.05})`
  const canvasBgColor = canvasSettings.bgColor || '#1a1a1a'

  const canvasBgStyle = {}
  if (pattern === 'dots') {
    canvasBgStyle.backgroundImage = `radial-gradient(circle, ${dotColor} ${canvasSettings.dotSize ?? 1.5}px, transparent 0)`
    canvasBgStyle.backgroundSize = `${canvasSettings.dotSpacing ?? 25}px ${canvasSettings.dotSpacing ?? 25}px`
  } else if (pattern === 'grid') {
    canvasBgStyle.backgroundImage = `linear-gradient(${lineColor} ${canvasSettings.lineWidth ?? 1}px, transparent 0), linear-gradient(90deg, ${lineColor} ${canvasSettings.lineWidth ?? 1}px, transparent 0)`
    canvasBgStyle.backgroundSize = `${canvasSettings.gridSpacing ?? 30}px ${canvasSettings.gridSpacing ?? 30}px`
  }
  // 'solid' — no backgroundImage

  const drawPathRef = useRef(null)
  useEffect(() => {
    drawPathRef.current = drawPath
  }, [drawPath])

  // --- Coordinate conversion ---
  const screenToCanvas = useCallback(
    (clientX, clientY) => {
      const rect = containerRef.current.getBoundingClientRect()
      return {
        x: (clientX - rect.left - canvas.offsetX) / canvas.scale,
        y: (clientY - rect.top - canvas.offsetY) / canvas.scale,
      }
    },
    [canvas],
  )

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // --- Wheel: zoom ---
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault()
      closeContextMenu()
      const rect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.min(Math.max(canvas.scale * delta, 0.1), 5)
      const newOffsetX = mouseX - (mouseX - canvas.offsetX) * (newScale / canvas.scale)
      const newOffsetY = mouseY - (mouseY - canvas.offsetY) * (newScale / canvas.scale)
      updateCanvas({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY })
    },
    [canvas, updateCanvas, closeContextMenu],
  )

  // Register wheel event
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // --- Mouse down ---
  const handleMouseDown = useCallback(
    (e) => {
      if (e.target.closest('[data-context-menu]')) return
      closeContextMenu()

      // --- Space-drag panning (works over cards too, like PureRef/Figma) ---
      if (spaceHeldRef.current && e.button === 0 && !e.altKey) {
        setIsPanning(true)
        setPanStart({ x: e.clientX - canvas.offsetX, y: e.clientY - canvas.offsetY })
        panSourceRef.current = 'space'
        clearSelection()
        e.preventDefault()
        return
      }

      // --- Drawing mode ---
      if (drawMode && e.button === 0 && !e.altKey) {
        const isBg = e.target === containerRef.current || e.target.classList.contains('canvas-bg')
        if (isBg) {
          const { x, y } = screenToCanvas(e.clientX, e.clientY)
          setDrawPath({ points: [{ x, y }], color: drawColor })
          e.preventDefault()
          return
        }
        return
      }

      // --- Resize handle click ---
      const resizeHandle = e.target.closest('[data-resize-handle]')
      if (resizeHandle) {
        const handle = resizeHandle.getAttribute('data-resize-handle')
        const cardEl = resizeHandle.closest('[data-card-id]')
        const cardId = cardEl?.getAttribute('data-card-id')
        const card = cards.find((c) => c.id === cardId)
        if (card) {
          e.stopPropagation()
          e.preventDefault()
          const { x, y } = screenToCanvas(e.clientX, e.clientY)
          const startH = typeof card.height === 'number' ? card.height : 200
          // For image cards, lock to natural aspect ratio for smooth proportional scaling
          const isImage = card.type === 'image'
          const naturalRatio = isImage && card.naturalWidth > 0
            ? card.naturalHeight / card.naturalWidth
            : null
          const ratio = naturalRatio ?? (card.width > 0 ? startH / card.width : 0.75)
          setResizing({
            cardId,
            handle,
            startX: x,
            startY: y,
            startW: card.width,
            startH,
            startCardX: card.x,
            startCardY: card.y,
            ratio,
            isImage,
          })
        }
        return
      }

      // --- Card click ---
      const cardEl = e.target.closest('[data-card-id]')
      if (cardEl && e.button === 0 && !e.altKey) {
        const cardId = cardEl.getAttribute('data-card-id')
        if (drawMode) return

        const card = cards.find((c) => c.id === cardId)
        if (!card) return

        if (editingGroupId && card.groupId !== editingGroupId) {
          e.stopPropagation()
          return
        }

        e.stopPropagation()

        if (e.ctrlKey || e.metaKey) {
          selectCard(cardId, 'toggle')
        } else if (!selectedIds.includes(cardId)) {
          selectCard(cardId, 'single')
        }

        let idsToMove = [cardId]
        if (card.groupId && !editingGroupId) {
          const groupMembers = cards.filter((c) => c.groupId === card.groupId).map((c) => c.id)
          if (groupMembers.length > 1) idsToMove = groupMembers
        } else if (selectedIds.includes(cardId) && selectedIds.length > 1) {
          idsToMove = [...selectedIds]
        }

        const startPositions = cards
          .filter((c) => idsToMove.includes(c.id))
          .map((c) => ({
            id: c.id,
            x: c.x,
            y: c.y,
            w: c.width || 220,
            h: typeof c.height === 'number' ? c.height : 200,
          }))

        useStore.getState()._pushHistory()

        const { x, y } = screenToCanvas(e.clientX, e.clientY)
        setDraggingCard(cardId)
        setDragStart({ x, y, startPositions })
        return
      }

      // --- Collapsed group proxy: drag whole group ---
      const proxyEl = e.target.closest('[data-group-proxy]')
      if (proxyEl && e.button === 0 && !e.altKey && !drawMode) {
        if (proxyEl.closest('[data-no-drag]')) return // let expand button handle click
        const groupId = proxyEl.getAttribute('data-group-proxy')
        const members = cards.filter((c) => c.groupId === groupId)
        if (members.length) {
          e.stopPropagation()
          if (!(e.ctrlKey || e.metaKey)) {
            selectCards(members.map((c) => c.id), 'single')
          }
          const startPositions = members.map((c) => ({
            id: c.id,
            x: c.x,
            y: c.y,
            w: c.width || 220,
            h: typeof c.height === 'number' ? c.height : 200,
          }))
          useStore.getState()._pushHistory()
          const { x, y } = screenToCanvas(e.clientX, e.clientY)
          setDraggingCard(members[0].id)
          setDragStart({ x, y, startPositions })
          return
        }
      }

      // --- Canvas background click ---
      const isBg = e.target === containerRef.current || e.target.classList.contains('canvas-bg')
      if (isBg) {
        if (editingGroupId) {
          exitGroupEdit()
          e.preventDefault()
          return
        }
        if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
          setIsPanning(true)
          setPanStart({ x: e.clientX - canvas.offsetX, y: e.clientY - canvas.offsetY })
          clearSelection()
          e.preventDefault()
        } else if (e.button === 0 && !e.altKey) {
          const { x, y } = screenToCanvas(e.clientX, e.clientY)
          setBoxSelect({ startX: x, startY: y, currentX: x, currentY: y })
          clearSelection()
        }
      }
    },
    [drawMode, drawColor, screenToCanvas, cards, selectedIds, selectCard, selectCards, clearSelection, canvas, closeContextMenu, editingGroupId, exitGroupEdit],
  )

  // --- Right-click on canvas background ---
  const handleCanvasContextMenu = useCallback(
    (e) => {
      if (drawMode) return
      const isBg = e.target === containerRef.current || e.target.classList.contains('canvas-bg')
      if (isBg) {
        e.preventDefault()
        if (editingGroupId) {
          exitGroupEdit()
          return
        }
        const imageCount = cards.filter((c) => c.type === 'image').length
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          cardId: null,
          isCanvas: true,
          selectedIds: [...selectedIds],
          selectedCount: selectedIds.length,
          hasSelection: selectedIds.length > 0,
          imageCount,
        })
      }
    },
    [selectedIds, drawMode, cards, editingGroupId, exitGroupEdit],
  )

  // --- Mouse move ---
  const handleMouseMove = useCallback(
    (e) => {
      if (isPanning) {
        updateCanvas({
          offsetX: e.clientX - panStart.x,
          offsetY: e.clientY - panStart.y,
        })
        return
      }

      if (drawPath) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY)
        setDrawPath((prev) => {
          if (!prev) return prev
          const last = prev.points[prev.points.length - 1]
          if (Math.abs(x - last.x) < 1 && Math.abs(y - last.y) < 1) return prev
          return { ...prev, points: [...prev.points, { x, y }] }
        })
        return
      }

      if (boxSelect) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY)
        setBoxSelect((prev) => ({ ...prev, currentX: x, currentY: y }))
        return
      }

      if (resizing) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY)
        const card = cards.find((c) => c.id === resizing.cardId)
        if (!card) return

        const dx = x - resizing.startX
        const dy = y - resizing.startY
        let newW = resizing.startW
        let newH = resizing.startH
        let newX = card.x
        let newY = card.y
        const minSize = 30
        const handle = resizing.handle

        if (handle.includes('e')) newW = Math.max(minSize, resizing.startW + dx)
        if (handle.includes('w')) {
          newW = Math.max(minSize, resizing.startW - dx)
          newX = resizing.startCardX + dx
        }
        if (handle.includes('s')) newH = Math.max(minSize, resizing.startH + dy)
        if (handle.includes('n')) {
          newH = Math.max(minSize, resizing.startH - dy)
          newY = resizing.startCardY + dy
        }

        // Image cards always scale proportionally (smooth / infinite scaling)
        if (resizing.isImage) {
          const ratio = resizing.ratio || 0.75
          // Use the dimension that changed most to determine scale
          const scaleFromW = newW / resizing.startW
          const scaleFromH = newH / resizing.startH
          const scale = Math.max(scaleFromW, scaleFromH)
          newW = Math.max(minSize, resizing.startW * scale)
          newH = Math.max(minSize, newW * ratio)

          // Re-anchor position based on handle direction
          if (handle.includes('w')) {
            newX = resizing.startCardX + resizing.startW - newW
          }
          if (handle.includes('n')) {
            newY = resizing.startCardY + resizing.startH - newH
          }
        } else if (handle.length === 2 && !e.shiftKey) {
          const startRatio = resizing.startW / resizing.startH
          if (handle === 'se' || handle === 'nw') {
            newH = newW / startRatio
            if (handle === 'nw') newY = resizing.startCardY + resizing.startH - newH
          }
          if (handle === 'sw' || handle === 'ne') {
            newH = newW / startRatio
            if (handle === 'sw') newX = resizing.startCardX + resizing.startW - newW
            if (handle === 'ne') newY = resizing.startCardY + resizing.startH - newH
          }
        }

        updateCard(resizing.cardId, {
          width: Math.round(newW),
          height: Math.round(newH),
          x: Math.round(newX),
          y: Math.round(newY),
        })
        return
      }

      if (draggingCard && dragStart) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY)
        const dx = x - dragStart.x
        const dy = y - dragStart.y
        const state = useStore.getState()

        const updatesMap = {}
        dragStart.startPositions.forEach((pos) => {
          const { x: sx, y: sy, guides } = calcSnap(
            state.cards,
            pos.id,
            pos.x + dx,
            pos.y + dy,
            pos.w,
            pos.h,
            canvas.scale,
          )
          if (pos.id === draggingCard) {
            setAlignGuides(guides.v.length || guides.h.length ? guides : null)
          }
          updatesMap[pos.id] = { x: sx, y: sy }
        })
        batchUpdateCards(updatesMap)
      }
    },
    [
      isPanning, panStart, draggingCard, dragStart, resizing, boxSelect, drawPath,
      canvas, updateCanvas, screenToCanvas, updateCard, batchUpdateCards,
      cards, selectedIds,
    ],
  )

  // --- Middle-click panning (capture phase — works even over cards) ---
  const handleMiddleMouseDownCapture = useCallback(
    (e) => {
      if (e.button === 1) {
        e.preventDefault()
        e.stopPropagation()
        isPanningRef.current = true
        panStartRef.current = { x: e.clientX - canvas.offsetX, y: e.clientY - canvas.offsetY }
        setIsPanning(true)
        setPanStart(panStartRef.current)
        clearSelection()
      }
    },
    [canvas, clearSelection],
  )

  const handleMiddleMouseMoveCapture = useCallback(
    (e) => {
      if (isPanningRef.current) {
        e.preventDefault()
        updateCanvas({
          offsetX: e.clientX - panStartRef.current.x,
          offsetY: e.clientY - panStartRef.current.y,
        })
      }
    },
    [updateCanvas],
  )

  const handleMiddleMouseUpCapture = useCallback(
    (e) => {
      if (e.button === 1 && isPanningRef.current) {
        isPanningRef.current = false
        setIsPanning(false)
      }
    },
    [],
  )

  // --- Mouse up ---
  const handleMouseUp = useCallback(
    (e) => {
      panSourceRef.current = null
      if (drawPath && drawPath.points.length > 1) {
        const finished = () => {
          const dp = drawPathRef.current
          if (!dp || dp.points.length <= 1) return
          const { points, color } = dp
          const xs = points.map((p) => p.x)
          const ys = points.map((p) => p.y)
          const minX = Math.min(...xs) - 2
          const minY = Math.min(...ys) - 2
          const maxX = Math.max(...xs) + 2
          const maxY = Math.max(...ys) + 2
          const w = Math.max(maxX - minX, 30)
          const h = Math.max(maxY - minY, 30)
          const relPoints = points.map((p) => ({
            x: p.x - minX,
            y: p.y - minY,
          }))
          const svgPath = relPoints
            .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
            .join(' ')
          addCard('drawing', {
            x: minX,
            y: minY,
            width: w,
            height: h,
            svgPath,
            strokeColor: color,
            strokeWidth: 2,
          })
        }
        finished()
        setDrawPath(null)
        return
      }
      setDrawPath(null)

      if (boxSelect) {
        const { startX, startY, currentX, currentY } = boxSelect
        if (Math.abs(currentX - startX) > 3 || Math.abs(currentY - startY) > 3) {
          const box = {
            x: Math.min(startX, currentX),
            y: Math.min(startY, currentY),
            w: Math.abs(currentX - startX),
            h: Math.abs(currentY - startY),
          }
          const ids = hitTest(cards, box)
          if (ids.length > 0) {
            selectCards(ids, 'box')
          }
        }
      }

      setIsPanning(false)
      setDraggingCard(null)
      setDragStart(null)
      setResizing(null)
      setBoxSelect(null)
      setAlignGuides(null)
    },
    [boxSelect, cards, selectCards, drawPath, addCard],
  )

  // --- Global mouse up ---
  useEffect(() => {
    const handleGlobalUp = () => {
      const dp = drawPathRef.current
      if (dp && dp.points.length > 1) {
        const { points, color } = dp
        const xs = points.map((p) => p.x)
        const ys = points.map((p) => p.y)
        const minX = Math.min(...xs) - 2
        const minY = Math.min(...ys) - 2
        const maxX = Math.max(...xs) + 2
        const maxY = Math.max(...ys) + 2
        const w = Math.max(maxX - minX, 30)
        const h = Math.max(maxY - minY, 30)
        const relPoints = points.map((p) => ({ x: p.x - minX, y: p.y - minY }))
        const svgPath = relPoints
          .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
          .join(' ')
        addCard('drawing', {
          x: minX,
          y: minY,
          width: w,
          height: h,
          svgPath,
          strokeColor: color,
          strokeWidth: 2,
        })
      }
      setDrawPath(null)
      setIsPanning(false)
      setDraggingCard(null)
      setDragStart(null)
      setResizing(null)
      setBoxSelect(null)
      setAlignGuides(null)
    }

    const handleGlobalClick = (e) => {
      if (!e.target.closest('[data-context-menu]')) {
        setContextMenu(null)
      }
    }

    window.addEventListener('mouseup', handleGlobalUp)
    window.addEventListener('mousedown', handleGlobalClick)
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp)
      window.removeEventListener('mousedown', handleGlobalClick)
    }
  }, [addCard])

  // --- Card right-click ---
  const handleCardContextMenu = useCallback(
    (card, e) => {
      if (drawMode) return
      e.preventDefault()
      e.stopPropagation()
      const state = useStore.getState()
      if (!state.selectedIds.includes(card.id)) {
        selectCard(card.id, 'single')
      }
      const selIds = state.selectedIds.includes(card.id)
        ? [...state.selectedIds]
        : [card.id]

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        cardId: card.id,
        isImage: card.type === 'image',
        isNote: card.type === 'note',
        isSpec: card.type === 'spec',
        isDrawing: card.type === 'drawing',
        isLabel: card.type === 'label',
        isCanvas: false,
        selectedIds: selIds,
        selectedCount: selIds.length,
        hasGroup: !!card.groupId,
        anyHasGroup: selIds.some((id) => {
          const c = state.cards.find((cc) => cc.id === id)
          return !!c?.groupId
        }),
      })
    },
    [drawMode, selectCard],
  )

  // --- Drop handler ---
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOverCanvas(false)
      const files = e.dataTransfer.files
      if (files.length > 0) {
        Array.from(files).forEach((file) => {
          if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file)
            const sourceUrl = (window.electronAPI && window.electronAPI.getFilePath)
              ? window.electronAPI.getFilePath(file) || file.name
              : file.name
            addCard('image', { imageUrl: url, name: file.name, sourceUrl, sourceType: 'drag' })
          }
        })
        return
      }
      const html = e.dataTransfer.getData('text/html')
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/)
      if (imgMatch) {
        addCard('image', { imageUrl: imgMatch[1], name: '拖入图片', sourceUrl: imgMatch[1], sourceType: 'url' })
        return
      }
      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
      if (url && (url.startsWith('http') || url.startsWith('https'))) {
        if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url)) {
          addCard('image', { imageUrl: url, name: '拖入图片', sourceUrl: url, sourceType: 'url' })
        }
      }
    },
    [addCard],
  )

  // --- ESC exits draw mode ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && drawMode) {
        setDrawMode(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawMode, setDrawMode])

  // --- Canvas keyboard shortcuts: space-pan, arrow nudge, F-fit ---
  useEffect(() => {
    const isTyping = (t) => {
      if (!t) return false
      const tag = t.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
    }

    const onKeyDown = (e) => {
      // --- SPACE → enter pan mode (release to exit) ---
      if (e.code === 'Space' && !isTyping(e.target)) {
        e.preventDefault()
        if (!spaceHeldRef.current) {
          spaceHeldRef.current = true
          setSpaceHeld(true)
          closeContextMenu()
        }
        return
      }

      // --- ARROW KEYS → nudge selected cards (1px, Shift=10px) ---
      if (e.key.startsWith('Arrow') && !isTyping(e.target)) {
        const state = useStore.getState()
        const sel = state.selectedIds
        if (sel.length === 0) return
        e.preventDefault()
        // One undo step per discrete press (hold = continuous, one step)
        if (!e.repeat) state._pushHistory()
        const step = e.shiftKey ? 10 : 1
        let dx = 0
        let dy = 0
        if (e.key === 'ArrowLeft') dx = -step
        if (e.key === 'ArrowRight') dx = step
        if (e.key === 'ArrowUp') dy = -step
        if (e.key === 'ArrowDown') dy = step
        const updates = {}
        state.cards.forEach((c) => {
          if (sel.includes(c.id) && !c.locked) {
            updates[c.id] = { x: (c.x || 0) + dx, y: (c.y || 0) + dy }
          }
        })
        if (Object.keys(updates).length > 0) state.batchUpdateCards(updates)
        return
      }

      // --- F → fit all / Shift+F → 100% ---
      if (
        (e.key === 'f' || e.key === 'F') &&
        !isTyping(e.target) &&
        !e.ctrlKey && !e.metaKey && !e.altKey
      ) {
        e.preventDefault()
        const state = useStore.getState()
        if (e.shiftKey) state.resetView()
        else state.focusAll()
        return
      }
    }

    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
        setSpaceHeld(false)
        if (panSourceRef.current === 'space') {
          setIsPanning(false)
          panSourceRef.current = null
        }
      }
    }

    const onBlur = () => {
      if (spaceHeldRef.current) {
        spaceHeldRef.current = false
        setSpaceHeld(false)
        if (panSourceRef.current === 'space') {
          setIsPanning(false)
          panSourceRef.current = null
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [closeContextMenu])

  // --- Mini reference window: capture + live sync (Electron only) ---
  const captureMiniSnapshot = useCallback(async () => {
    const el = containerRef.current
    if (!el) return null
    try {
      const c = await html2canvas(el, {
        backgroundColor: null,
        scale: 0.5,
        logging: false,
        useCORS: true,
      })
      return c.toDataURL('image/png')
    } catch {
      return null
    }
  }, [])

  const openMiniWindow = useCallback(async () => {
    if (!window.electronAPI?.openMiniWindow) return
    const dataUrl = await captureMiniSnapshot()
    if (!dataUrl) return
    window.electronAPI.openMiniWindow()
    window.electronAPI.updateMiniWindow(dataUrl)
    if (!miniOpenRef.current) {
      miniOpenRef.current = true
      miniSubRef.current = useStore.subscribe(() => {
        if (miniTimerRef.current) clearTimeout(miniTimerRef.current)
        miniTimerRef.current = setTimeout(async () => {
          const url = await captureMiniSnapshot()
          if (url) window.electronAPI?.updateMiniWindow(url)
        }, 1200)
      })
    }
  }, [captureMiniSnapshot])

  // Stop live sync when the mini window is closed from the other side
  useEffect(() => {
    const handler = () => {
      miniOpenRef.current = false
      if (miniSubRef.current) {
        miniSubRef.current()
        miniSubRef.current = null
      }
      if (miniTimerRef.current) clearTimeout(miniTimerRef.current)
    }
    if (window.electronAPI?.onMiniWindowClosed) {
      window.electronAPI.onMiniWindowClosed(handler)
    }
    return () => {
      if (miniSubRef.current) miniSubRef.current()
      if (miniTimerRef.current) clearTimeout(miniTimerRef.current)
    }
  }, [])

  // ==================== RENDER ====================

  return (
    <div
      ref={containerRef}
      data-canvas-container
      className="moodboard-canvas canvas-bg"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseDownCapture={handleMiddleMouseDownCapture}
      onMouseMoveCapture={handleMiddleMouseMoveCapture}
      onMouseUpCapture={handleMiddleMouseUpCapture}
      onContextMenu={handleCanvasContextMenu}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOverCanvas(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || e.target.classList.contains('canvas-bg')) {
          setDragOverCanvas(false)
        }
      }}
      onDrop={handleDrop}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        cursor: drawMode
          ? 'crosshair'
          : isPanning
            ? 'grabbing'
            : spaceHeld
              ? 'grab'
              : boxSelect
                ? 'crosshair'
                : 'default',
        border: dragOverCanvas
          ? '2px dashed var(--accent-default)'
          : '2px solid transparent',
        backgroundColor: canvasBgColor,
        ...canvasBgStyle,
      }}
    >
      {/* Grid — rendered via CSS pseudo-elements on canvas-bg class */}

      {/* Draw mode indicator */}
      {drawMode && (
        <div
          className="glass-light"
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            borderRadius: 'var(--radius-md)',
            padding: '6px 18px',
            fontSize: 'var(--text-xs)',
            color: 'var(--semantic-warning)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          ✏️ 绘制模式 — 点击画布拖拽画线 — 按 Esc 退出
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: drawColor,
              border: '1px solid rgba(255,255,255,0.3)',
              display: 'inline-block',
            }}
          />
        </div>
      )}

      {/* Group-edit mode indicator */}
      {editingGroupId && (
        <div
          className="glass-light"
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            borderRadius: 'var(--radius-md)',
            padding: '6px 18px',
            fontSize: 'var(--text-xs)',
            color: 'var(--accent-default)',
            pointerEvents: 'none',
          }}
        >
          🔗 组内编辑模式 — 双击空白处或按 Esc 退出
        </div>
      )}

      {/* URL Importer */}
      {showImporter && <ImageImporter onClose={toggleImporter} />}

      {/* Transformed card layer */}
      <div
        style={{
          position: 'absolute',
          transform: `translate(${canvas.offsetX}px, ${canvas.offsetY}px) scale(${canvas.scale})`,
          transformOrigin: '0 0',
          width: 0,
          height: 0,
        }}
      >
        {/* Collapsed group proxies (folded to icons) */}
        {Object.entries(collapsedGroups).filter(([, v]) => v).map(([gid]) => {
          const members = cards.filter((c) => c.groupId === gid)
          if (!members.length) return null
          const xs = members.map((c) => c.x)
          const ys = members.map((c) => c.y)
          const xe = members.map((c) => c.x + (c.width || 220))
          const ye = members.map((c) => c.y + (typeof c.height === 'number' ? c.height : 200))
          const minX = Math.min(...xs)
          const minY = Math.min(...ys)
          const bboxW = Math.max(Math.max(...xe) - minX, 80)
          return (
            <GroupProxy
              key={`proxy-${gid}`}
              groupId={gid}
              x={minX}
              y={minY}
              bboxW={bboxW}
              count={members.length}
              onExpand={toggleGroupCollapsed}
            />
          )
        })}

        {cards.map((card) => {
          if (card.groupId && collapsedGroups[card.groupId]) return null
          const isDimmed = editingGroupId && card.groupId !== editingGroupId
          const cardOpacity = isDimmed ? 0.25 : (typeof card.opacity === 'number' ? card.opacity : 1)
          const opacityStyle = isDimmed
            ? { opacity: cardOpacity, pointerEvents: 'none' }
            : (cardOpacity !== 1 ? { opacity: cardOpacity } : undefined)
          return (
          <div
            key={card.id}
            onMouseDown={(e) => {
              // Handled in handleMouseDown via event delegation
            }}
            onClick={(e) => {
              // Handled in handleMouseDown
            }}
            onDoubleClick={(e) => {
              if (card.groupId && !editingGroupId) {
                e.stopPropagation()
                enterGroupEdit(card.groupId)
              }
            }}
            onContextMenu={(e) => handleCardContextMenu(card, e)}
            style={opacityStyle}
          >
            <CardNode card={card} />
          </div>
          )
        })}

        {boxSelect && <SelectionBox boxSelect={boxSelect} />}
        {drawPath && drawPath.points.length > 1 && <DrawingPreview drawPath={drawPath} />}
      </div>

      {/* Alignment guides (in screen space) — accent colored dashed */}
      {alignGuides && (
        <AlignGuidesOverlay guides={alignGuides} canvas={canvas} />
      )}

      {/* Drop overlay */}
      {dragOverCanvas && (
        <div
          className="glass-strong"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '32px 48px',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--accent-default)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            pointerEvents: 'none',
            zIndex: 50,
            textAlign: 'center',
          }}
        >
          松开以导入图片
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu menu={contextMenu} onClose={closeContextMenu} onSettingsClick={onSettingsClick} onMiniWindow={openMiniWindow} />
      )}

      {/* Zoom controls — extracted component */}
      <ZoomControls />

      {/* Floating property bar — opacity for single selected card */}
      <PropertyBar />

      {/* Bottom-left hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 10,
          fontSize: 10,
          color: 'var(--text-tertiary)',
          opacity: 0.4,
          transition: 'opacity 300ms ease-out',
          pointerEvents: 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        {drawMode
          ? 'Esc 退出绘制 | 拖拽画线'
          : editingGroupId
            ? '组内编辑中 | Esc 或双击空白退出'
            : '拖拽框选 | Ctrl+点击多选 | 右键菜单 | 空格/中键平移 | 滚轮缩放 | 方向键微移 | F 适配 | Ctrl+G 编组 | 双击组进组编辑 | 右键折叠组'}
      </div>
    </div>
  )
}

// ==================== Sub-components ====================

/**
 * PropertyBar — floating glass bar shown when exactly one card is selected.
 * Currently exposes single-image/multi-card opacity (PureRef-style transparency).
 */
function PropertyBar() {
  const selectedIds = useStore((s) => s.selectedIds)
  const cards = useStore((s) => s.cards)
  const batchUpdateCards = useStore((s) => s.batchUpdateCards)
  const pushHistory = useStore((s) => s._pushHistory)

  const single = selectedIds.length === 1 ? cards.find((c) => c.id === selectedIds[0]) : null
  const [draft, setDraft] = useState(100)
  const pushedRef = useRef(false)
  const prevIdRef = useRef(null)

  // Sync draft when selection changes
  useEffect(() => {
    if (single?.id !== prevIdRef.current) {
      prevIdRef.current = single?.id
      pushedRef.current = false
      if (single) setDraft(Math.round((single.opacity ?? 1) * 100))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single?.id])

  // Sync draft when opacity changes externally (e.g. undo)
  useEffect(() => {
    if (single) setDraft(Math.round((single.opacity ?? 1) * 100))
  }, [single?.opacity])

  if (!single) return null

  const commitStart = () => {
    if (!pushedRef.current) {
      pushHistory()
      pushedRef.current = true
    }
  }
  const onChange = (e) => {
    const v = Number(e.target.value)
    setDraft(v)
    batchUpdateCards({ [single.id]: { opacity: v / 100 } })
  }
  const onCommit = () => { pushedRef.current = false }

  return (
    <div
      className="glass-light"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-card)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        不透明度
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={draft}
        onPointerDown={commitStart}
        onChange={onChange}
        onPointerUp={onCommit}
        onBlur={onCommit}
        onKeyDown={commitStart}
        onKeyUp={onCommit}
        style={{ width: 150, accentColor: 'var(--accent-default)', cursor: 'pointer' }}
      />
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          minWidth: 36,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 500,
        }}
      >
        {draft}%
      </span>
    </div>
  )
}

/**
 * GroupProxy — folded representation of a collapsed group (PureRef-style).
 * Acts as a draggable handle for the whole group; double-click or the
 * "展开" button expands it back.
 */
function GroupProxy({ groupId, x, y, bboxW, count, onExpand }) {
  const pw = Math.min(Math.max(bboxW, 90), 220)
  const ph = 44
  return (
    <div
      data-group-proxy={groupId}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onExpand(groupId)
      }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: pw,
        height: ph,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        cursor: 'grab',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-card)',
        boxShadow: 'var(--shadow-card)',
        color: 'var(--text-primary)',
        fontSize: 12,
        userSelect: 'none',
        zIndex: 5,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>📁</span>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        组 · {count} 项
      </span>
      <button
        data-no-drag
        onClick={(e) => {
          e.stopPropagation()
          onExpand(groupId)
        }}
        style={{
          flexShrink: 0,
          padding: '3px 8px',
          borderRadius: 'var(--radius-xs)',
          border: '1px solid var(--border-default)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'var(--font-family)',
        }}
      >
        展开
      </button>
    </div>
  )
}

function SelectionBox({ boxSelect }) {
  const { startX, startY, currentX, currentY } = boxSelect
  const sx = Math.min(startX, currentX)
  const sy = Math.min(startY, currentY)
  const sw = Math.abs(currentX - startX)
  const sh = Math.abs(currentY - startY)
  return (
    <div
      style={{
        position: 'absolute',
        left: sx,
        top: sy,
        width: sw,
        height: sh,
        border: '1px solid var(--accent-default)',
        background: 'var(--accent-muted)',
        pointerEvents: 'none',
        zIndex: 40,
      }}
    />
  )
}

function DrawingPreview({ drawPath }) {
  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 10000,
        height: 10000,
        pointerEvents: 'none',
        zIndex: 35,
        transform: 'translate(-5000px, -5000px)',
      }}
    >
      <path
        d={drawPath.points
          .map((p, i) =>
            i === 0
              ? `M ${p.x + 5000} ${p.y + 5000}`
              : `L ${p.x + 5000} ${p.y + 5000}`,
          )
          .join(' ')}
        fill="none"
        stroke={drawPath.color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  )
}

/** Alignment guides — accent-colored dashed lines. */
function AlignGuidesOverlay({ guides, canvas }) {
  return (
    <>
      {guides.h.map((g, i) => (
        <div
          key={`h-${i}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: canvas.offsetY + g.y * canvas.scale,
            height: 0,
            borderTop: '1px dashed var(--accent-default)',
            opacity: 0.7,
            pointerEvents: 'none',
            zIndex: 45,
          }}
        />
      ))}
      {guides.v.map((g, i) => (
        <div
          key={`v-${i}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: canvas.offsetX + g.x * canvas.scale,
            width: 0,
            borderLeft: '1px dashed var(--accent-default)',
            opacity: 0.7,
            pointerEvents: 'none',
            zIndex: 45,
          }}
        />
      ))}
    </>
  )
}

function ImageImporter({ onClose }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const addCard = useStore((s) => s.addCard)

  const handleFetch = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url.trim()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error('load failed'))
        setTimeout(() => reject(new Error('timeout')), 5000)
      })
      addCard('image', {
        imageUrl: url.trim(),
        name: url.trim().split('/').pop() || '网络图片',
        sourceUrl: url.trim(),
        sourceType: 'url',
      })
      setUrl('')
      onClose()
    } catch {
      alert('无法加载该图片链接，请检查URL是否以图片格式结尾（.jpg/.png等）')
    }
    setLoading(false)
  }

  return (
    <div
      className="glass-medium"
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        图片URL:
      </span>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/image.jpg"
        onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
        style={{
          width: 320,
          padding: '6px 10px',
          borderRadius: 'var(--radius-xs)',
          border: '1px solid var(--border-default)',
          background: 'var(--surface-base)',
          color: 'var(--text-primary)',
          fontSize: 'var(--text-sm)',
          outline: 'none',
          fontFamily: 'var(--font-family)',
        }}
      />
      <button
        onClick={handleFetch}
        disabled={loading}
        style={{
          padding: '6px 16px',
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: 'var(--accent-default)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          opacity: loading ? 0.6 : 1,
          fontFamily: 'var(--font-family)',
        }}
      >
        {loading ? '加载中...' : '抓取'}
      </button>
      <button
        onClick={onClose}
        style={{
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-default)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-family)',
        }}
      >
        ✕
      </button>
    </div>
  )
}
