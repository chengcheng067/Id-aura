/**
 * CategoryCard — a clickable card for a specification category in the SidePanel.
 *
 * Props:
 *   id: string          — category id
 *   name: string        — category display name
 *   icon: string        — emoji or text icon
 *   itemCount: number   — total items in this category
 *   isSelected: boolean — whether this category is currently active
 *   onClick: () => void
 */
export default function CategoryCard({ id, name, icon, itemCount, isSelected, onClick }) {
  const accentColor = hashColor(id)

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-card)',
        background: isSelected ? 'var(--accent-muted)' : 'var(--surface-card)',
        border: isSelected
          ? '1px solid var(--border-accent)'
          : '1px solid transparent',
        borderLeft: `3px solid ${isSelected ? 'var(--accent-default)' : accentColor}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6,
        transition: 'all 200ms ease-out',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--surface-card-hover)'
          e.currentTarget.style.borderColor = 'var(--border-default)'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = 'var(--shadow-card)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--surface-card)'
          e.currentTarget.style.borderColor = 'transparent'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
          {itemCount} 项规范
        </div>
      </div>
      {isSelected && (
        <span style={{ color: 'var(--accent-default)', fontSize: 12, fontWeight: 600 }}>
          ›
        </span>
      )}
    </div>
  )
}

/** Deterministic color from a string id — hues around accent blue region. */
function hashColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hues = [210, 180, 150, 240, 30, 300, 120, 0]
  const idx = Math.abs(hash) % hues.length
  const h = hues[idx]
  return `hsl(${h}, 50%, 55%)`
}
