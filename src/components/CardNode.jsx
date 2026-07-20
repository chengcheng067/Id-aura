import { useState } from 'react'
import useStore from '../store/useStore'

/**
 * CardNode — unified renderer for all 5 card types.
 *
 * Unchanged: all business logic (selection, drag delegation, resize, editing).
 * Changed: visual design (render output layer — JSX + styles).
 */

const HANDLE_SIZE = 6
const HANDLE_OFFSET = -HANDLE_SIZE / 2

export default function CardNode({ card }) {
  const selectedIds = useStore((s) => s.selectedIds)
  const isSelected = selectedIds.includes(card.id)
  const multiSelected = selectedIds.length > 1 && isSelected

  const [hovered, setHovered] = useState(false)

  const isImage = card.type === 'image'
  const isNote = card.type === 'note'
  const isDrawing = card.type === 'drawing'
  const isLabel = card.type === 'label'
  const isSpec = card.type === 'spec'

  const showResizeHandles = isSelected && (isImage || isDrawing || isLabel)
  const inGroup = !!card.groupId && (isSelected || multiSelected)

  if (isSpec) {
    return <SpecCard card={card} isSelected={isSelected} multiSelected={multiSelected} inGroup={inGroup} />
  }

  if (isImage) {
    return (
      <ImageCard
        card={card}
        isSelected={isSelected}
        multiSelected={multiSelected}
        hovered={hovered}
        inGroup={inGroup}
        onHover={(v) => setHovered(v)}
        showResizeHandles={showResizeHandles}
      />
    )
  }

  if (isDrawing) {
    return (
      <DrawingCard
        card={card}
        isSelected={isSelected}
        multiSelected={multiSelected}
        inGroup={inGroup}
        showResizeHandles={showResizeHandles}
      />
    )
  }

  if (isLabel) {
    return (
      <LabelCard
        card={card}
        isSelected={isSelected}
        multiSelected={multiSelected}
        inGroup={inGroup}
        showResizeHandles={showResizeHandles}
      />
    )
  }

  if (isNote) {
    return (
      <NoteCard
        card={card}
        isSelected={isSelected}
        multiSelected={multiSelected}
        inGroup={inGroup}
      />
    )
  }

  return null
}

// ==================== Spec Card ====================

function SpecCard({ card, isSelected, multiSelected, inGroup }) {
  const updateCard = useStore((s) => s.updateCard)
  const { specData, sectionTitle } = card
  const [isEditing, setIsEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(specData?.label || '')
  const [editValue, setEditValue] = useState(specData?.value || '')
  const [editNote, setEditNote] = useState(specData?.note || '')

  const priorityColor =
    specData?.priority === 'high'
      ? 'var(--priority-high)'
      : specData?.priority === 'medium'
        ? 'var(--priority-medium)'
        : 'var(--priority-low)'

  const selectedShadow = isSelected || multiSelected

  const saveEdit = () => {
    if (!editLabel.trim()) {
      setIsEditing(false)
      return
    }
    updateCard(card.id, {
      specData: {
        ...specData,
        label: editLabel.trim(),
        value: editValue.trim(),
        note: editNote.trim(),
      },
    })
    setIsEditing(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '4px 6px',
    marginBottom: 4,
    borderRadius: 'var(--radius-xs)',
    border: '1px solid var(--border-default)',
    background: 'var(--surface-base)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    outline: 'none',
    fontFamily: 'var(--font-family)',
    boxSizing: 'border-box',
  }

  return (
    <div
      data-card-id={card.id}
      data-card-type="spec"
      onDoubleClick={() => {
        if (card.type === 'spec') {
          setIsEditing(true)
          setEditLabel(specData?.label || '')
          setEditValue(specData?.value || '')
          setEditNote(specData?.note || '')
        }
      }}
      style={{
        position: 'absolute',
        left: card.x,
        top: card.y,
        width: card.width,
        borderRadius: 'var(--radius-md)',
        borderLeft: `3px solid ${priorityColor}`,
        cursor: isEditing ? 'default' : 'grab',
        overflow: 'hidden',
        border: isSelected || multiSelected
          ? `2px solid transparent`
          : '1px solid var(--border-default)',
        background: isSelected || multiSelected
          ? 'linear-gradient(var(--surface-card), var(--surface-card)) padding-box, var(--border-gradient) border-box'
          : 'var(--surface-card)',
        boxShadow: selectedShadow
          ? 'var(--shadow-card-hover), var(--elevation-2)'
          : 'var(--elevation-1)',
        transition: 'all 250ms ease-out',
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !multiSelected && !isEditing) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = 'var(--glow-card-hover), var(--elevation-2)'
          e.currentTarget.style.filter = 'brightness(1.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !multiSelected && !isEditing) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'var(--elevation-1)'
          e.currentTarget.style.filter = 'brightness(1)'
        }
      }}
    >
      {inGroup && <GroupBadge />}
      {isEditing ? (
        <div onClick={(e) => e.stopPropagation()} style={{ padding: 8 }}>
          <input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder="规范名称"
            style={inputStyle}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
              if (e.key === 'Escape') { e.preventDefault(); setIsEditing(false) }
              e.stopPropagation()
            }}
          />
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="标准值"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
              if (e.key === 'Escape') { e.preventDefault(); setIsEditing(false) }
              e.stopPropagation()
            }}
          />
          <input
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="备注（可选）"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
              if (e.key === 'Escape') { e.preventDefault(); setIsEditing(false) }
              e.stopPropagation()
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button
              onClick={saveEdit}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                background: 'var(--accent-default)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                fontFamily: 'var(--font-family)',
              }}
            >
              保存
            </button>
            <button
              onClick={() => setIsEditing(false)}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                fontFamily: 'var(--font-family)',
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div
            style={{
              padding: '8px 10px 6px',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
              {specData?.label}
            </span>
            {sectionTitle && (
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--accent-default)',
                  background: 'var(--accent-muted)',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                #{sectionTitle}
              </span>
            )}
          </div>
          {/* Value */}
          <div style={{ padding: '6px 10px 4px' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent-default)', lineHeight: 1.3 }}>
              {specData?.value}
            </div>
            {specData?.note && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                {specData.note}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ==================== Image Card ====================

function ImageCard({ card, isSelected, multiSelected, hovered, inGroup, onHover, showResizeHandles }) {
  const updateCard = useStore((s) => s.updateCard)

  // Use natural aspect ratio if available; otherwise derive from current dimensions
  const naturalRatio = card.naturalWidth > 0
    ? card.naturalHeight / card.naturalWidth
    : (card.width > 0 && typeof card.height === 'number' && card.height > 0)
        ? card.height / card.width
        : 0.75

  const displayHeight = Math.max(1, Math.round(card.width * naturalRatio))

  // Compute selection outline color (thin, no heavy border when not selected)
  const shadowVal = isSelected
    ? 'var(--aura-selected)'
    : multiSelected
      ? '0 0 0 1px var(--semantic-warning), var(--aura-glow-weak)'
      : hovered
        ? 'var(--shadow-card)'
        : 'none'

  return (
    <div
      data-card-id={card.id}
      data-card-type="image"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{
        position: 'absolute',
        left: card.x,
        top: card.y,
        width: card.width,
        height: displayHeight,
        cursor: 'grab',
        overflow: 'visible',
        borderRadius: 'var(--radius-sm)',
        boxShadow: shadowVal,
        outline: 'none',
        border: isSelected || multiSelected ? '2px solid transparent' : 'none',
        background: isSelected || multiSelected
          ? 'linear-gradient(var(--surface-card), var(--surface-card)) padding-box, var(--border-gradient) border-box'
          : 'transparent',
        transition: 'all 200ms ease-out',
        transform: hovered && !isSelected && !multiSelected ? 'translateY(-2px) scale(1.01)' : 'none',
      }}
    >
      {inGroup && <GroupBadge />}
      <img
        src={card.imageUrl}
        alt={card.name}
        draggable={false}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: 'var(--radius-xs)',
          transform: `${card.flipH ? 'scaleX(-1)' : ''} ${card.flipV ? 'scaleY(-1)' : ''}`,
        }}
        onLoad={(e) => {
          const img = e.target
          if (card.naturalWidth !== img.naturalWidth || card.naturalHeight !== img.naturalHeight) {
            updateCard(card.id, {
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              height: Math.max(1, Math.round(card.width * (img.naturalHeight / img.naturalWidth))),
            })
          }
        }}
        onError={(e) => {
          e.target.style.display = 'none'
          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
        }}
      />
      <div style={{ display: 'none', padding: 20, color: 'var(--text-tertiary)', fontSize: 12, position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        加载失败
      </div>
      {showResizeHandles && <ResizeHandles card={{ ...card, height: displayHeight }} />}
    </div>
  )
}

// ==================== Drawing Card ====================

function DrawingCard({ card, isSelected, multiSelected, inGroup, showResizeHandles }) {
  const borderStyle = isSelected || multiSelected
    ? '2px solid transparent'
    : '1px solid transparent'

  return (
    <div
      data-card-id={card.id}
      data-card-type="drawing"
      style={{
        position: 'absolute',
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        cursor: 'grab',
        overflow: 'visible',
        borderRadius: 'var(--radius-sm)',
        boxShadow: isSelected ? 'var(--shadow-card-hover)' : 'none',
        transition: 'all 250ms ease-out',
        background: 'transparent',
        border: borderStyle,
        backgroundClip: 'padding-box',
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !multiSelected) {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'
          e.currentTarget.style.boxShadow = 'var(--shadow-card)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !multiSelected) {
          e.currentTarget.style.transform = 'translateY(0) scale(1)'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      {inGroup && <GroupBadge />}
      <svg width={card.width} height={card.height} style={{ display: 'block' }}>
        <path
          d={card.svgPath}
          fill="none"
          stroke={card.strokeColor || '#6ea8fe'}
          strokeWidth={card.strokeWidth || 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
      </svg>
      {/* Corner anchor points when selected */}
      {isSelected && (
        <CornerAnchors w={card.width} h={typeof card.height === 'number' ? card.height : 200} />
      )}
      {showResizeHandles && <ResizeHandles card={card} />}
    </div>
  )
}

/** Corner anchor indicators for DrawingCard selected state. */
function CornerAnchors({ w, h }) {
  const corners = [
    { x: 0, y: 0 },
    { x: w + HANDLE_OFFSET * 2, y: 0 },
    { x: 0, y: h + HANDLE_OFFSET * 2 },
    { x: w + HANDLE_OFFSET * 2, y: h + HANDLE_OFFSET * 2 },
  ]
  return (
    <>
      {corners.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: c.x,
            top: c.y,
            width: 6,
            height: 6,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-default)',
            border: '1px solid rgba(255,255,255,0.5)',
            zIndex: 29,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  )
}

// ==================== Label Card ====================

function LabelCard({ card, isSelected, multiSelected, inGroup, showResizeHandles }) {
  const updateCard = useStore((s) => s.updateCard)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')

  const bgColor = card.backgroundColor || 'rgba(110, 168, 254, 0.06)'

  return (
    <div
      data-card-id={card.id}
      data-card-type="label"
      style={{
        position: 'absolute',
        left: card.x,
        top: card.y,
        width: card.width,
        background: bgColor,
        borderRadius: 'var(--radius-sm)',
        borderLeft: `4px solid ${card.color || 'var(--accent-default)'}`,
        cursor: 'grab',
        minWidth: 60,
        minHeight: 28,
        border: isSelected || multiSelected
          ? `2px solid ${multiSelected ? 'var(--semantic-warning)' : 'var(--accent-default)'}`
          : '1px solid var(--border-default)',
        boxShadow: isSelected || multiSelected
          ? 'var(--glow-accent), var(--elevation-2)'
          : 'var(--elevation-1)',
        transition: 'all 250ms ease-out',
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !multiSelected) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = 'var(--glow-card-hover), var(--elevation-2)'
          e.currentTarget.style.filter = 'brightness(1.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !multiSelected) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'var(--elevation-1)'
          e.currentTarget.style.filter = 'brightness(1)'
        }
      }}
    >
      {inGroup && <GroupBadge />}
      {editing ? (
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={() => {
            setEditing(false)
            if (editText.trim()) updateCard(card.id, { text: editText })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              setEditing(false)
              if (editText.trim()) updateCard(card.id, { text: editText })
            }
            e.stopPropagation()
          }}
          autoFocus
          style={{
            width: '100%',
            padding: '5px 8px',
            background: 'transparent',
            color: 'var(--text-primary)',
            border: 'none',
            outline: 'none',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-family)',
            borderRadius: 'var(--radius-sm)',
            resize: 'both',
            minHeight: 24,
          }}
        />
      ) : (
        <div
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing(true)
            setEditText(card.text || '')
          }}
          style={{
            padding: '5px 8px',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            cursor: 'text',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            display: 'flex',
            alignItems: 'center',
            minHeight: 24,
          }}
        >
          {card.text || '双击编辑标签'}
        </div>
      )}
      {showResizeHandles && <ResizeHandles card={card} />}
    </div>
  )
}

// ==================== Note Card ====================

function NoteCard({ card, isSelected, multiSelected, inGroup }) {
  const updateCard = useStore((s) => s.updateCard)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')

  return (
    <div
      data-card-id={card.id}
      data-card-type="note"
      style={{
        position: 'absolute',
        left: card.x,
        top: card.y,
        width: card.width,
        background: '#2d2818',
        color: '#d4c88c',
        borderRadius: '2px 10px 2px 10px',
        cursor: 'grab',
        minHeight: 60,
        border: isSelected || multiSelected
          ? `2px solid ${multiSelected ? 'var(--semantic-warning)' : 'var(--accent-default)'}`
          : '1px solid rgba(212, 200, 140, 0.15)',
        boxShadow: isSelected || multiSelected
          ? 'var(--glow-accent), 2px 3px 8px rgba(0,0,0,0.3)'
          : '2px 3px 8px rgba(0,0,0,0.3)',
        transition: 'all 250ms ease-out',
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !multiSelected) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = 'var(--glow-card-hover), 2px 3px 8px rgba(0,0,0,0.3)'
          e.currentTarget.style.filter = 'brightness(1.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !multiSelected) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '2px 3px 8px rgba(0,0,0,0.3)'
          e.currentTarget.style.filter = 'brightness(1)'
        }
      }}
    >
      {inGroup && <GroupBadge />}
      {editing ? (
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={() => {
            setEditing(false)
            if (editText.trim()) updateCard(card.id, { text: editText })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
            e.stopPropagation()
          }}
          autoFocus
          style={{
            width: '100%',
            minHeight: 80,
            padding: 8,
            background: '#2d2818',
            color: '#d4c88c',
            border: 'none',
            outline: 'none',
            fontSize: 'var(--text-sm)',
            resize: 'vertical',
            fontFamily: 'var(--font-family)',
            borderRadius: '2px 10px 2px 10px',
          }}
        />
      ) : (
        <div
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing(true)
            setEditText(card.text || '')
          }}
          style={{
            padding: 10,
            fontSize: 'var(--text-sm)',
            color: '#d4c88c',
            lineHeight: 1.6,
            cursor: 'text',
            minHeight: 40,
          }}
        >
          {card.text}
        </div>
      )}
    </div>
  )
}

// ==================== Shared Helpers ====================

function GroupBadge() {
  return (
    <div
      style={{
        position: 'absolute',
        top: -10,
        right: -10,
        zIndex: 31,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: 'var(--semantic-warning)',
        color: 'var(--text-inverse)',
        fontSize: 10,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        lineHeight: 1,
      }}
    >
      G
    </div>
  )
}

/** 8-drag-handle resize controls with accent-colored rounded-square handles. */
function ResizeHandles({ card }) {
  const w = card.width || 280
  const h = typeof card.height === 'number' ? card.height : 200

  const handles = [
    { id: 'nw', x: HANDLE_OFFSET, y: HANDLE_OFFSET, cursor: 'nw-resize' },
    { id: 'n', x: w / 2 + HANDLE_OFFSET, y: HANDLE_OFFSET, cursor: 'n-resize' },
    { id: 'ne', x: w + HANDLE_OFFSET, y: HANDLE_OFFSET, cursor: 'ne-resize' },
    { id: 'e', x: w + HANDLE_OFFSET, y: h / 2 + HANDLE_OFFSET, cursor: 'e-resize' },
    { id: 'se', x: w + HANDLE_OFFSET, y: h + HANDLE_OFFSET, cursor: 'se-resize' },
    { id: 's', x: w / 2 + HANDLE_OFFSET, y: h + HANDLE_OFFSET, cursor: 's-resize' },
    { id: 'sw', x: HANDLE_OFFSET, y: h + HANDLE_OFFSET, cursor: 'sw-resize' },
    { id: 'w', x: HANDLE_OFFSET, y: h / 2 + HANDLE_OFFSET, cursor: 'w-resize' },
  ]

  return (
    <>
      {handles.map((h) => (
        <div
          key={h.id}
          data-resize-handle={h.id}
          style={{
            position: 'absolute',
            left: h.x,
            top: h.y,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: 'var(--accent-default)',
            border: '1.5px solid rgba(255,255,255,0.6)',
            borderRadius: 'var(--radius-sm)',
            cursor: h.cursor,
            zIndex: 30,
            boxShadow: '0 0 4px rgba(0,0,0,0.3)',
          }}
        />
      ))}
    </>
  )
}
