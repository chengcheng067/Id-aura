import { useState, useRef, useEffect } from 'react'

/**
 * ToolbarButton — icon button with optional active/danger states and glass tooltip.
 *
 * Props:
 *   icon: React.ElementType  — lucide-react icon component
 *   tooltip: string           — function name
 *   shortcut?: string         — keyboard shortcut hint
 *   active?: boolean          — selected/active state
 *   danger?: boolean          — dangerous action (red highlight)
 *   disabled?: boolean
 *   onClick: () => void
 */
export default function ToolbarButton({
  icon: Icon,
  tooltip,
  shortcut,
  active,
  danger,
  disabled,
  onClick,
}) {
  const [hovered, setHovered] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [pressed, setPressed] = useState(false)
  const hoverTimerRef = useRef(null)

  const handleMouseEnter = () => {
    setHovered(true)
    hoverTimerRef.current = setTimeout(() => {
      setShowTooltip(true)
    }, 300)
  }

  const handleMouseLeave = () => {
    setHovered(false)
    setShowTooltip(false)
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  const btnBg = active
    ? 'var(--accent-muted)'
    : hovered && danger
      ? 'rgba(240, 101, 72, 0.12)'
      : hovered
        ? 'rgba(255, 255, 255, 0.06)'
        : 'transparent'

  const btnColor = active
    ? 'var(--accent-default)'
    : danger
      ? 'var(--semantic-danger)'
      : disabled
        ? 'var(--text-tertiary)'
        : 'var(--text-secondary)'

  const btnBorder = active
    ? '1px solid var(--border-accent)'
    : hovered
      ? '1px solid var(--border-strong)'
      : '1px solid transparent'

  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <button
        onClick={disabled ? undefined : onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        disabled={disabled}
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-sm)',
          border: btnBorder,
          background: btnBg,
          color: btnColor,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          opacity: disabled ? 0.4 : 1,
          transition: 'all 150ms var(--liquid-ease)',
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
          flexShrink: 0,
        }}
      >
        <Icon size={18} strokeWidth={1.75} />
      </button>

      {/* Tooltip — rendered below the button so it's not clipped at top of viewport */}
      {showTooltip && (
        <div
          className="glass-light"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap',
            zIndex: 200,
            animationName: 'tooltipFadeIn',
            animationDuration: '120ms',
            animationTimingFunction: 'ease-out',
            animationFillMode: 'forwards',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
            {tooltip}
          </span>
          {shortcut && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                background: 'rgba(255,255,255,0.06)',
                padding: '1px 5px',
                borderRadius: 3,
                fontFamily: 'var(--font-family)',
              }}
            >
              {shortcut}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
