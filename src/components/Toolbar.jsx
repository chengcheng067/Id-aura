import { useState, useEffect } from 'react'
import {
  Pin,
  PinOff,
  Undo2,
  Redo2,
  Library,
  ImagePlus,
  Link2,
  StickyNote,
  Tag,
  ClipboardPaste,
  Pencil,
  Save,
  FolderOpen,
  Download,
  Trash2,
  Settings,
  Minimize2,
} from 'lucide-react'
import useStore from '../store/useStore'
import ToolbarButton from './ToolbarButton'

export default function Toolbar({ fileLoadRef, fileInputRef, onSettingsClick, onCollapse }) {
  const showSidePanel = useStore((s) => s.showSidePanel)
  const togglePanel = useStore((s) => s.togglePanel)
  const drawMode = useStore((s) => s.drawMode)
  const drawColor = useStore((s) => s.drawColor)
  const setDrawMode = useStore((s) => s.setDrawMode)
  const setDrawColor = useStore((s) => s.setDrawColor)
  const saving = useStore((s) => s.saving)
  const cards = useStore((s) => s.cards)
  const addCard = useStore((s) => s.addCard)
  const clearAll = useStore((s) => s.clearAll)
  const saveProject = useStore((s) => s.saveProject)
  const toggleImporter = useStore((s) => s.toggleImporter)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.canUndo)
  const canRedo = useStore((s) => s.canRedo)

  // Toolbar visibility from settings
  const toolbarVisible = useStore((s) => new Set(s.settings.toolbar?.visible || []))
  const isVisible = (id) => toolbarVisible.has(id)

  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  useEffect(() => {
    if (window.electronAPI?.isAlwaysOnTop) {
      window.electronAPI.isAlwaysOnTop().then(setAlwaysOnTop)
    }
  }, [])
  const toggleAlwaysOnTop = async () => {
    if (window.electronAPI?.setAlwaysOnTop) {
      const next = await window.electronAPI.setAlwaysOnTop(!alwaysOnTop)
      setAlwaysOnTop(next)
    }
  }

  const DRAW_COLORS = [
    '#6ea8fe',
    '#e5b042',
    '#56d48c',
    '#f06548',
    '#c084fc',
    '#ffffff',
    '#ff4081',
  ]

  const handleExport = async () => {
    try {
      const canvasEl = document.querySelector('.moodboard-canvas')
      if (!canvasEl) return
      const html2canvas = (await import('html2canvas')).default
      const dataUrl = await html2canvas(canvasEl, {
        backgroundColor: '#0d0d0d',
        scale: 2,
        useCORS: true,
        allowTaint: true,
      })
      const link = document.createElement('a')
      link.download = `moodboard_${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
    } catch {
      alert('导出失败')
    }
  }

  const handlePaste = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const url = URL.createObjectURL(blob)
            addCard('image', { imageUrl: url, name: '剪贴板图片', sourceType: 'clipboard' })
            return
          }
        }
      }
      alert('剪贴板中没有图片')
    } catch {
      alert('无法读取剪贴板，请尝试直接 Ctrl+V')
    }
  }

  const cardCount = cards.length

  // Build visible button groups.
  const groups = []

  if (isVisible('alwaysOnTop')) {
    groups.push(
      <div key="window" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <ToolbarButton
          icon={alwaysOnTop ? PinOff : Pin}
          tooltip={alwaysOnTop ? '取消窗口置顶' : '窗口置顶'}
          shortcut={alwaysOnTop ? undefined : '浮在其他窗口上方'}
          active={alwaysOnTop}
          onClick={toggleAlwaysOnTop}
        />
      </div>
    )
  }

  if (isVisible('undo') || isVisible('redo')) {
    groups.push(
      <div key="undoRedo" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isVisible('undo') && (
          <ToolbarButton
            icon={Undo2}
            tooltip="撤销"
            shortcut="Ctrl+Z"
            disabled={!canUndo()}
            onClick={undo}
          />
        )}
        {isVisible('redo') && (
          <ToolbarButton
            icon={Redo2}
            tooltip="重做"
            shortcut="Ctrl+Shift+Z"
            disabled={!canRedo()}
            onClick={redo}
          />
        )}
      </div>
    )
  }

  if (isVisible('panel') || isVisible('addImage') || isVisible('urlImport') || isVisible('note') || isVisible('label') || isVisible('paste')) {
    groups.push(
      <div key="content" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isVisible('panel') && (
          <ToolbarButton
            icon={Library}
            tooltip="规范库"
            shortcut="Tab"
            active={showSidePanel}
            onClick={togglePanel}
          />
        )}
        {isVisible('addImage') && (
          <ToolbarButton
            icon={ImagePlus}
            tooltip="添加图片"
            onClick={() => fileInputRef.current?.click()}
          />
        )}
        {isVisible('urlImport') && (
          <ToolbarButton
            icon={Link2}
            tooltip="从URL导入图片"
            onClick={toggleImporter}
          />
        )}
        {isVisible('note') && (
          <ToolbarButton
            icon={StickyNote}
            tooltip="添加备注"
            shortcut="N"
            onClick={() => addCard('note')}
          />
        )}
        {isVisible('label') && (
          <ToolbarButton
            icon={Tag}
            tooltip="添加文字标签"
            shortcut="L"
            onClick={() => addCard('label')}
          />
        )}
        {isVisible('paste') && (
          <ToolbarButton
            icon={ClipboardPaste}
            tooltip="从剪贴板粘贴"
            shortcut="Ctrl+V"
            onClick={handlePaste}
          />
        )}
      </div>
    )
  }

  if (isVisible('draw')) {
    groups.push(
      <div key="draw" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <ToolbarButton
          icon={Pencil}
          tooltip={drawMode ? '退出绘制模式' : '绘制模式'}
          shortcut="Esc"
          active={drawMode}
          onClick={() => setDrawMode(!drawMode)}
        />
        {drawMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 2 }}>
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setDrawColor(c)}
                title={`画笔颜色: ${c}`}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: c,
                  border: drawColor === c
                    ? '2px solid #fff'
                    : '2px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  padding: 0,
                  boxShadow: drawColor === c ? '0 0 6px rgba(255,255,255,0.3)' : 'none',
                  transition: 'all 100ms ease-out',
                }}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (isVisible('save') || isVisible('open') || isVisible('export') || isVisible('clear')) {
    groups.push(
      <div key="file" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isVisible('save') && (
          <ToolbarButton
            icon={Save}
            tooltip="保存项目"
            shortcut="Ctrl+S"
            disabled={saving}
            onClick={saveProject}
          />
        )}
        {isVisible('open') && (
          <ToolbarButton
            icon={FolderOpen}
            tooltip="打开项目"
            shortcut="Ctrl+O"
            onClick={() => fileLoadRef.current?.click()}
          />
        )}
        {isVisible('export') && (
          <ToolbarButton
            icon={Download}
            tooltip="导出为PNG"
            onClick={handleExport}
          />
        )}
        {isVisible('clear') && (
          <ToolbarButton
            icon={Trash2}
            tooltip="清空画布"
            danger
            onClick={clearAll}
          />
        )}
      </div>
    )
  }

  if (isVisible('settings')) {
    groups.push(
      <div key="settings" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <ToolbarButton
          icon={Settings}
          tooltip="设置"
          shortcut="Ctrl+,"
          onClick={onSettingsClick}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        alignSelf: 'center',
        minHeight: 48,
        display: 'flex',
        alignItems: 'center',
        padding: '4px 16px',
        gap: 4,
        flexShrink: 0,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '100%',
        overflow: 'visible',
        zIndex: 100,
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--shadow-panel)',
      }}
    >
      {/* Collapse button */}
      <ToolbarButton
        icon={Minimize2}
        tooltip="折叠工具栏"
        onClick={onCollapse}
      />

      {/* Brand */}
      <img src="./assets/icon.png" alt="ID Aura" style={{ width: 28, height: 28, margin: '0 6px', borderRadius: 6, flexShrink: 0 }} />
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          background: 'var(--accent-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginRight: 10,
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}
      >
        ID Aura
      </span>

      {groups.length > 0 && <Divider />}

      {groups.map((group, idx) => (
        <div key={group.key} style={{ display: 'flex', alignItems: 'center' }}>
          {idx > 0 && <Divider />}
          {group}
        </div>
      ))}

      {/* Card count pill badge */}
      {isVisible('cardCount') && (
        <span
          style={{
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-full)',
            padding: '3px 10px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            letterSpacing: 0.3,
            marginLeft: 'auto',
          }}
        >
          {cardCount} 张卡片
        </span>
      )}
    </div>
  )
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 22,
        background: 'var(--border-default)',
        margin: '0 6px',
        flexShrink: 0,
      }}
    />
  )
}
