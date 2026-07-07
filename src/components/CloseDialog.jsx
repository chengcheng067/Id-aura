import { useEffect } from 'react'

/**
 * CloseDialog — dark glass modal confirming project save before exit.
 *
 * Styled consistently with SettingsModal (dark glass, backdrop blur).
 * Three actions: Cancel / Discard / Save & Close.
 */
export default function CloseDialog({ onCancel, onDiscard, onSave }) {
  // Close on ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onCancel])

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          background: 'rgba(20, 22, 28, 0.92)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), var(--glow-accent)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Title */}
        <div
          style={{
            padding: '20px 24px 12px',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          是否保存当前项目？
        </div>

        {/* Body */}
        <div
          style={{
            padding: '0 24px 20px',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          当前项目包含未保存的更改。选择保存后再关闭，以避免丢失工作内容。
        </div>

        {/* Actions — right aligned */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 24px 16px',
            borderTop: '1px solid var(--border-default)',
          }}
        >
          {/* Cancel */}
          <button
            onClick={onCancel}
            style={{
              padding: '7px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              transition: 'all 150ms ease-out',
              fontFamily: 'var(--font-family)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            取消
          </button>

          {/* Discard */}
          <button
            onClick={onDiscard}
            style={{
              padding: '7px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--semantic-error)',
              background: 'transparent',
              color: 'var(--semantic-error)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              transition: 'all 150ms ease-out',
              fontFamily: 'var(--font-family)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 77, 77, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            不保存
          </button>

          {/* Save & Close */}
          <button
            onClick={onSave}
            style={{
              padding: '7px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--accent-default)',
              color: 'var(--text-inverse, #fff)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              transition: 'all 150ms ease-out',
              fontFamily: 'var(--font-family)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-default)'
            }}
          >
            保存并关闭
          </button>
        </div>
      </div>
    </div>
  )
}
