import { useRef } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import useStore from '../store/useStore'

/**
 * ZoomControls — glass floating panel in the bottom-right corner, next to the AI bubble.
 * Extracted from Canvas.jsx for modularity.
 *
 * Features:
 *   - +/- zoom buttons with centered scaling
 *   - Percentage display (click to reset to fit or 100%)
 *   - Glass background with backdrop-filter
 */
export default function ZoomControls() {
  const canvas = useStore((s) => s.canvas)
  const updateCanvas = useStore((s) => s.updateCanvas)
  const focusAll = useStore((s) => s.focusAll)
  const resetView = useStore((s) => s.resetView)
  const containerRef = useRef(null)

  const zoomCentered = (factor) => {
    const rect = containerRef.current?.closest('[data-canvas-container]')?.getBoundingClientRect()
    if (!rect) {
      updateCanvas({ scale: Math.min(Math.max(canvas.scale * factor, 0.1), 5) })
      return
    }
    const cx = rect.width / 2
    const cy = rect.height / 2
    const newScale = Math.min(Math.max(canvas.scale * factor, 0.1), 5)
    const newOffsetX = cx - (cx - canvas.offsetX) * (newScale / canvas.scale)
    const newOffsetY = cy - (cy - canvas.offsetY) * (newScale / canvas.scale)
    updateCanvas({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY })
  }

  const handlePercentClick = () => {
    // Toggle between fit-all and 100%
    const currentScale = canvas.scale
    if (Math.abs(currentScale - 1) < 0.01) {
      focusAll()
    } else {
      resetView()
    }
  }

  const currentPercent = Math.round(canvas.scale * 100)

  return (
    <div
      ref={containerRef}
      className="glass-light"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 88,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        zIndex: 50,
        padding: 4,
        borderRadius: 'var(--radius-card)',
      }}
    >
      <ZoomBtn onClick={() => zoomCentered(1 / 1.2)} title="缩小">
        <ZoomOut size={16} strokeWidth={1.75} />
      </ZoomBtn>

      <span
        onClick={handlePercentClick}
        title="点击重置缩放"
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          padding: '0 6px',
          cursor: 'pointer',
          fontWeight: 500,
          minWidth: 38,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
          userSelect: 'none',
          transition: 'color 150ms ease-out',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        {currentPercent}%
      </span>

      <ZoomBtn onClick={() => zoomCentered(1.2)} title="放大">
        <ZoomIn size={16} strokeWidth={1.75} />
      </ZoomBtn>
    </div>
  )
}

function ZoomBtn({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid transparent',
        background: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'all 150ms ease-out',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--hover-subtle)'
        e.currentTarget.style.color = 'var(--text-primary)'
        e.currentTarget.style.transform = 'scale(1.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-secondary)'
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      {children}
    </button>
  )
}
