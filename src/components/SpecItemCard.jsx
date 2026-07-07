export default function SpecItemCard({ item, onAdd }) {
  const priorityColor =
    item.priority === 'high'
      ? 'var(--priority-high)'
      : item.priority === 'medium'
        ? 'var(--priority-medium)'
        : 'var(--priority-low)'

  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-card)',
        marginBottom: 6,
        border: '1px solid transparent',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        transition: 'all 200ms ease-out',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)'
        e.currentTarget.style.background = 'var(--surface-card-hover)'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-card)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'transparent'
        e.currentTarget.style.background = 'var(--surface-card)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
      onClick={onAdd}
      title="点击添加到图版"
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          flexShrink: 0,
          marginTop: 5,
          background: priorityColor,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
          {item.label}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-hover)', margin: '2px 0' }}>
          {item.value}
        </div>
        {item.note && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
            {item.note}
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: 14,
          color: 'var(--accent-default)',
          flexShrink: 0,
          marginTop: 2,
          opacity: 0.6,
          transition: 'opacity 150ms ease-out',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6' }}
      >
        +
      </span>
    </div>
  )
}
