import { useRef, useEffect, useState } from 'react'
import {
  Undo2,
  Redo2,
  Link2,
  Unlink2,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  ImagePlus,
  Tag,
  StickyNote,
  Download,
  Maximize2,
  ArrowLeftRight,
  ArrowUpDown,
  Clipboard,
  Scaling,
  LayoutGrid,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  StretchHorizontal,
  StretchVertical,
  Settings,
} from 'lucide-react'
import useStore from '../store/useStore'
import { exportSingleImage, exportBatchImages } from '../utils/exportImage'

/**
 * ContextMenu — unified right-click menu with glass design.
 *
 * Unchanged: all business logic (export, align, arrange, group, delete, etc.).
 * Changed: visual design (glass bg, lucide icons, three-column layout, entry animation).
 */
export default function ContextMenu({ menu, onClose, onSettingsClick }) {
  const menuRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  // Store actions
  const addCard = useStore((s) => s.addCard)
  const deleteCards = useStore((s) => s.deleteCards)
  const bringToFront = useStore((s) => s.bringToFront)
  const sendToBack = useStore((s) => s.sendToBack)
  const groupCards = useStore((s) => s.groupCards)
  const ungroupCards = useStore((s) => s.ungroupCards)
  const alignCards = useStore((s) => s.alignCards)
  const arrangeCards = useStore((s) => s.arrangeCards)
  const resizeImagesToUniform = useStore((s) => s.resizeImagesToUniform)
  const updateCard = useStore((s) => s.updateCard)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.canUndo)
  const canRedo = useStore((s) => s.canRedo)
  const cards = useStore((s) => s.cards)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const doAndClose = (fn) => {
    fn()
    onClose()
  }

  const selIds = menu.selectedIds || []
  const hasMultiSelect = menu.selectedCount > 1
  const imageCount = cards.filter((c) => c.type === 'image').length

  // Position: clamp to viewport
  const x = Math.min(menu.x, window.innerWidth - 280)
  const y = Math.min(menu.y, window.innerHeight - 600)

  // --- Export helpers ---
  const handleExportSingle = async (format) => {
    if (exporting) return
    const card = cards.find((c) => c.id === menu.cardId)
    if (!card || card.type !== 'image') return
    setExporting(true)
    setExportMsg('导出中...')
    const result = await exportSingleImage(card.imageUrl, format, card.name || '图片')
    setExporting(false)
    if (result.success) {
      setExportMsg(`已导出${result.filePath ? ': ' + result.filePath : ''}`)
    } else {
      setExportMsg(`导出失败: ${result.error}`)
    }
    setTimeout(() => setExportMsg(''), 2500)
    onClose()
  }

  const handleExportBatch = async (format) => {
    if (exporting) return
    const selCards = cards.filter(
      (c) => selIds.includes(c.id) && c.type === 'image'
    )
    if (selCards.length === 0) return
    setExporting(true)
    setExportMsg(`正在导出 ${selCards.length} 张...`)
    const images = selCards.map((c) => ({ imageUrl: c.imageUrl, name: c.name }))
    const result = await exportBatchImages(images, format)
    setExporting(false)
    if (result.failed === 0) {
      setExportMsg(`已导出 ${result.success} 张图片`)
    } else {
      setExportMsg(`导出 ${result.success} 张，失败 ${result.failed} 张`)
    }
    setTimeout(() => setExportMsg(''), 3000)
    onClose()
  }

  // --- Unified size helpers (PureRef-style auto-normalize) ---
  const handleUnifiedSize = (mode) => {
    const imageIds = cards
      .filter((c) => selIds.includes(c.id) && c.type === 'image')
      .map((c) => c.id)
    if (imageIds.length === 0) return
    resizeImagesToUniform(imageIds, mode)
  }

  // --- Copy source URL ---
  const handleCopySource = () => {
    const card = cards.find((c) => c.id === menu.cardId)
    if (!card || !card.sourceUrl) return
    navigator.clipboard.writeText(card.sourceUrl).catch(() => {})
    setExportMsg('来源链接已复制')
    setTimeout(() => setExportMsg(''), 2000)
  }

  const sourceLabel = (card) => {
    if (!card || !card.sourceType) return null
    switch (card.sourceType) {
      case 'local': return '本地文件'
      case 'clipboard': return '剪贴板'
      case 'url': return '网络链接'
      case 'drag': return '拖放导入'
      default: return card.sourceType
    }
  }

  return (
    <div
      ref={menuRef}
      data-context-menu
      className="glass-medium"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        minWidth: 210,
        padding: '4px 0',
        overflow: 'hidden',
        animation: 'menuFadeIn 150ms ease-out',
        maxHeight: '80vh',
        overflowY: 'auto',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {/* ===== Multi-select ===== */}
      {hasMultiSelect && (
        <>
          <SectionTitle>已选 {menu.selectedCount} 项</SectionTitle>
          <MenuItem
            icon={Link2}
            label="编组"
            shortcut="Ctrl+G"
            onClick={() => doAndClose(() => groupCards(selIds))}
          />
          {menu.anyHasGroup && (
            <MenuItem
              icon={Unlink2}
              label="取消编组"
              shortcut="Ctrl+Shift+G"
              onClick={() => doAndClose(() => ungroupCards(selIds))}
            />
          )}
          <MenuItem
            icon={Trash2}
            label="删除选中"
            danger
            onClick={() => doAndClose(() => deleteCards(selIds))}
          />

          <Divider />
          <SectionTitle>对齐 — 基于当前选中的卡片</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, padding: '2px 8px' }}>
            <AlignBtn icon={AlignStartVertical} onClick={() => doAndClose(() => alignCards(selIds, 'left'))} title="左对齐" />
            <AlignBtn icon={AlignCenterVertical} onClick={() => doAndClose(() => alignCards(selIds, 'center-x'))} title="水平居中" />
            <AlignBtn icon={AlignEndVertical} onClick={() => doAndClose(() => alignCards(selIds, 'right'))} title="右对齐" />
            <AlignBtn icon={AlignStartHorizontal} onClick={() => doAndClose(() => alignCards(selIds, 'top'))} title="顶对齐" />
            <AlignBtn icon={AlignCenterHorizontal} onClick={() => doAndClose(() => alignCards(selIds, 'center-y'))} title="垂直居中" />
            <AlignBtn icon={AlignEndHorizontal} onClick={() => doAndClose(() => alignCards(selIds, 'bottom'))} title="底对齐" />
          </div>
          <MenuItem
            icon={StretchHorizontal}
            label="水平等距分布"
            onClick={() => doAndClose(() => alignCards(selIds, 'distribute-x'))}
          />
          <MenuItem
            icon={StretchVertical}
            label="垂直等距分布"
            onClick={() => doAndClose(() => alignCards(selIds, 'distribute-y'))}
          />

          {/* Unified size */}
          {cards.some((c) => selIds.includes(c.id) && c.type === 'image') && (
            <>
              <Divider />
              <SectionTitle>统一大小</SectionTitle>
              <MenuItem
                icon={Scaling}
                label="统一宽度"
                onClick={() => doAndClose(() => handleUnifiedSize('width'))}
              />
              <MenuItem
                icon={Scaling}
                label="统一高度"
                onClick={() => doAndClose(() => handleUnifiedSize('height'))}
              />
              <MenuItem
                icon={Scaling}
                label="统一尺寸"
                onClick={() => doAndClose(() => handleUnifiedSize('both'))}
              />
            </>
          )}

          {/* Arrange selected */}
          {cards.some((c) => selIds.includes(c.id) && c.type === 'image') && (
            <>
              <Divider />
              <SectionTitle>排列选中图片</SectionTitle>
              <MenuItem icon={LayoutGrid} label="自动排列 − 最优" onClick={() => doAndClose(() => arrangeCards('optimal', selIds))} />
              <MenuItem icon={LayoutGrid} label="按名称" onClick={() => doAndClose(() => arrangeCards('name', selIds))} />
              <MenuItem icon={LayoutGrid} label="按顺序" onClick={() => doAndClose(() => arrangeCards('order', selIds))} />
              <MenuItem icon={LayoutGrid} label="按添加时间" onClick={() => doAndClose(() => arrangeCards('addition', selIds))} />
              <MenuItem icon={LayoutGrid} label="随机排列" onClick={() => doAndClose(() => arrangeCards('random', selIds))} />
            </>
          )}

          {/* Batch export */}
          {cards.some((c) => selIds.includes(c.id) && c.type === 'image') && (
            <>
              <Divider />
              <SectionTitle>批量导出</SectionTitle>
              <MenuItem icon={Download} label="导出选中为 PNG" onClick={() => doAndClose(() => handleExportBatch('png'))} />
              <MenuItem icon={Download} label="导出选中为 JPG" onClick={() => doAndClose(() => handleExportBatch('jpeg'))} />
            </>
          )}

          <Divider />
          <MenuItem icon={ArrowUpToLine} label="置于顶层" onClick={() => doAndClose(() => bringToFront(selIds))} />
          <MenuItem icon={ArrowDownToLine} label="置于底层" onClick={() => doAndClose(() => sendToBack(selIds))} />
          <Divider />
          <MenuItem icon={Settings} label="打开设置" shortcut="Ctrl+," onClick={() => doAndClose(() => onSettingsClick?.())} />
        </>
      )}

      {/* ===== Single image card ===== */}
      {!hasMultiSelect && menu.isImage && (
        <>
          <SectionTitle>图片操作</SectionTitle>
          <MenuItem
            icon={Maximize2}
            label="适应图片尺寸"
            onClick={() => doAndClose(() => fitToImage(menu.cardId))}
          />
          <MenuItem
            icon={ArrowLeftRight}
            label="水平翻转"
            onClick={() => doAndClose(() => {
              updateCard(menu.cardId, { flipH: !cards.find(c => c.id === menu.cardId)?.flipH })
            })}
          />
          <MenuItem
            icon={ArrowUpDown}
            label="垂直翻转"
            onClick={() => doAndClose(() => {
              updateCard(menu.cardId, { flipV: !cards.find(c => c.id === menu.cardId)?.flipV })
            })}
          />

          <Divider />
          <SectionTitle>导出图片</SectionTitle>
          <MenuItem icon={Download} label="导出为 PNG" onClick={() => doAndClose(() => handleExportSingle('png'))} />
          <MenuItem icon={Download} label="导出为 JPG" onClick={() => doAndClose(() => handleExportSingle('jpeg'))} />

          {/* Source info */}
          {(() => {
            const card = cards.find((c) => c.id === menu.cardId)
            if (card && card.sourceUrl) {
              return (
                <>
                  <Divider />
                  <SectionTitle>来源: {sourceLabel(card)}</SectionTitle>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-primary)',
                      padding: '2px 16px 4px',
                      wordBreak: 'break-all',
                      maxWidth: 240,
                    }}
                  >
                    {card.sourceUrl.length > 60
                      ? card.sourceUrl.slice(0, 60) + '...'
                      : card.sourceUrl}
                  </div>
                  <MenuItem
                    icon={Clipboard}
                    label="复制来源链接"
                    onClick={() => doAndClose(() => handleCopySource())}
                  />
                </>
              )
            }
            return null
          })()}

          <Divider />
          <MenuItem icon={ArrowUpToLine} label="置于顶层" onClick={() => doAndClose(() => bringToFront([menu.cardId]))} />
          <MenuItem icon={ArrowDownToLine} label="置于底层" onClick={() => doAndClose(() => sendToBack([menu.cardId]))} />
          {menu.hasGroup && (
            <MenuItem icon={Unlink2} label="取消编组" onClick={() => doAndClose(() => ungroupCards([menu.cardId]))} />
          )}
          <MenuItem icon={Trash2} label="删除" danger onClick={() => doAndClose(() => deleteCards([menu.cardId]))} />

          <Divider />
          <SectionTitle>全部图片 — 排列方式</SectionTitle>
          <MenuItem icon={LayoutGrid} label="自动排列 − 最优" onClick={() => doAndClose(() => arrangeCards('optimal'))} />
          <MenuItem icon={LayoutGrid} label="按名称" onClick={() => doAndClose(() => arrangeCards('name'))} />
          <MenuItem icon={LayoutGrid} label="按路径" onClick={() => doAndClose(() => arrangeCards('path'))} />
          <MenuItem icon={LayoutGrid} label="按顺序" onClick={() => doAndClose(() => arrangeCards('order'))} />
          <MenuItem icon={LayoutGrid} label="按添加时间" onClick={() => doAndClose(() => arrangeCards('addition'))} />
          <MenuItem icon={LayoutGrid} label="随机排列" onClick={() => doAndClose(() => arrangeCards('random'))} />

          <Divider />
          <SectionTitle>全部图片 — 批量操作</SectionTitle>
          <MenuItem
            icon={Maximize2}
            label="全部适应图片尺寸"
            onClick={() => doAndClose(() => {
              cards.filter(c => c.type === 'image').forEach(c => fitToImage(c.id))
            })}
          />
          <MenuItem
            icon={Scaling}
            label="统一大小 (280×200)"
            onClick={() => doAndClose(() => batchResizeImages(280, 200))}
          />
          <MenuItem
            icon={Scaling}
            label="统一大小 (200×200)"
            onClick={() => doAndClose(() => batchResizeImages(200, 200))}
          />
        </>
      )}

      {/* ===== Single note / drawing / label card ===== */}
      {!hasMultiSelect && !menu.isImage && !menu.isCanvas && (
        <>
          <MenuItem icon={ArrowUpToLine} label="置于顶层" onClick={() => doAndClose(() => bringToFront([menu.cardId]))} />
          <MenuItem icon={ArrowDownToLine} label="置于底层" onClick={() => doAndClose(() => sendToBack([menu.cardId]))} />
          {menu.hasGroup && (
            <MenuItem icon={Unlink2} label="取消编组" onClick={() => doAndClose(() => ungroupCards([menu.cardId]))} />
          )}
          <MenuItem icon={Trash2} label="删除" danger onClick={() => doAndClose(() => deleteCards([menu.cardId]))} />
        </>
      )}

      {/* ===== Canvas background ===== */}
      {menu.isCanvas && (
        <>
          <SectionTitle>画布操作</SectionTitle>
          <MenuItem
            icon={Undo2}
            label="撤销"
            shortcut="Ctrl+Z"
            disabled={!canUndo()}
            onClick={() => doAndClose(() => undo())}
          />
          <MenuItem
            icon={Redo2}
            label="重做"
            shortcut="Ctrl+Shift+Z"
            disabled={!canRedo()}
            onClick={() => doAndClose(() => redo())}
          />
          <Divider />
          <MenuItem
            icon={ImagePlus}
            label="导入图片"
            onClick={() =>
              doAndClose(() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.multiple = true
                input.accept = 'image/*'
                input.onchange = (ev) => {
                  Array.from(ev.target.files).forEach((file) => {
                    if (file.type.startsWith('image/')) {
                      const url = URL.createObjectURL(file)
                      const sourceUrl = (window.electronAPI && window.electronAPI.getFilePath)
                        ? window.electronAPI.getFilePath(file) || file.name
                        : file.name
                      addCard('image', { imageUrl: url, name: file.name, sourceUrl, sourceType: 'local' })
                    }
                  })
                }
                input.click()
              })
            }
          />
          <MenuItem icon={Tag} label="添加文字标签" onClick={() => doAndClose(() => addCard('label'))} />
          <MenuItem icon={StickyNote} label="添加备注" onClick={() => doAndClose(() => addCard('note'))} />
          {imageCount > 0 && (
            <>
              <Divider />
              <SectionTitle>全部图片 — 排列</SectionTitle>
              <MenuItem icon={LayoutGrid} label="自动排列 − 最优" onClick={() => doAndClose(() => arrangeCards('optimal'))} />
              <MenuItem icon={LayoutGrid} label="按名称排列" onClick={() => doAndClose(() => arrangeCards('name'))} />
              <MenuItem icon={LayoutGrid} label="按路径排列" onClick={() => doAndClose(() => arrangeCards('path'))} />
              <MenuItem icon={LayoutGrid} label="按顺序排列" onClick={() => doAndClose(() => arrangeCards('order'))} />
              <MenuItem icon={LayoutGrid} label="按添加时间排列" onClick={() => doAndClose(() => arrangeCards('addition'))} />
              <MenuItem icon={LayoutGrid} label="随机排列" onClick={() => doAndClose(() => arrangeCards('random'))} />
            </>
          )}
          <Divider />
          <MenuItem icon={Settings} label="打开设置" shortcut="Ctrl+," onClick={() => doAndClose(() => onSettingsClick?.())} />
        </>
      )}

      {/* Export status toast */}
      {exportMsg && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--accent-default)',
            padding: '4px 16px',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--accent-muted)',
            textAlign: 'center',
          }}
        >
          {exportMsg}
        </div>
      )}
    </div>
  )

  // Inner helpers that need store/cards closure
  function fitToImage(cardId) {
    const card = cards.find((c) => c.id === cardId)
    if (!card || card.type !== 'image') return
    const img = new Image()
    img.onload = () => {
      const maxW = 400
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > maxW) {
        h = h * (maxW / w)
        w = maxW
      }
      updateCard(cardId, { width: Math.round(w), height: Math.round(h) + 30 })
    }
    img.src = card.imageUrl
  }

  function batchResizeImages(w, h) {
    useStore.getState()._pushHistory()
    const updatesMap = {}
    cards
      .filter((c) => c.type === 'image')
      .forEach((c) => { updatesMap[c.id] = { width: w, height: h } })
    useStore.getState().batchUpdateCards(updatesMap)
  }
}

// ==================== Sub-components ====================

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: 'var(--text-tertiary)',
        padding: '4px 14px 3px',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: 'var(--border-default)',
        margin: '3px 6px',
      }}
    />
  )
}

function MenuItem({ icon: Icon, label, shortcut, onClick, danger, disabled }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 10px',
        fontSize: 'var(--text-sm)',
        color: disabled ? 'var(--text-tertiary)' : danger ? 'var(--semantic-danger)' : 'var(--text-primary)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        border: 'none',
        background: hovered && !disabled
          ? danger
            ? 'rgba(240, 101, 72, 0.12)'
            : 'rgba(255, 255, 255, 0.06)'
          : 'transparent',
        width: '100%',
        textAlign: 'left',
        borderRadius: 0,
        opacity: disabled ? 0.4 : 1,
        transition: 'background 100ms ease-out',
        fontFamily: 'var(--font-family)',
      }}
    >
      <Icon
        size={18}
        strokeWidth={1.5}
        style={{
          color: disabled ? 'var(--text-tertiary)' : danger ? 'var(--semantic-danger)' : 'var(--text-secondary)',
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            background: 'rgba(255,255,255,0.06)',
            padding: '1px 5px',
            borderRadius: 3,
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  )
}

function AlignBtn({ icon: Icon, onClick, title }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        padding: '5px 0',
        border: 'none',
        background: hovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        borderRadius: 'var(--radius-xs)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 100ms ease-out',
      }}
    >
      <Icon size={16} strokeWidth={1.5} />
    </button>
  )
}
