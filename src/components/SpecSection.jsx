import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function SpecSection({ title, itemCount, children }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div
      style={{
        marginBottom: 8,
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-card)',
        overflow: 'hidden',
        transition: 'box-shadow 200ms ease-out',
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
          {title}
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              marginLeft: 8,
            }}
          >
            ({itemCount}项)
          </span>
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          style={{
            color: 'var(--text-tertiary)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease-out',
            flexShrink: 0,
          }}
        />
      </div>

      <div
        style={{
          maxHeight: expanded ? 2000 : 0,
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 200ms ease-out, opacity 200ms ease-out',
        }}
      >
        <div style={{ padding: '0 12px 10px' }}>{children}</div>
      </div>
    </div>
  )
}
