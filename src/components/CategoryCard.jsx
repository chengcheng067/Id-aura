/**
 * CategoryCard — magnetic tile for a specification category in the SidePanel.
 * Layout: icon centered on top, name below, spec count as a subtle badge.
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
        padding: '14px 8px 10px',
        borderRadius: 'var(--radius-card)',
        background: isSelected
          ? 'var(--accent-muted)'
          : 'rgba(255,255,255,0.04)',
        border: isSelected
          ? '1px solid var(--border-accent)'
          : '1px solid rgba(255,255,255,0.06)',
        borderTop: isSelected
          ? `2px solid var(--accent-default)`
          : `2px solid ${accentColor}`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        transition: 'all 200ms ease-out',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = 'var(--aura-glow-weak), 0 4px 12px rgba(0,0,0,0.3)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      {/* Name */}
      <div
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
          color: isSelected ? 'var(--accent-default)' : 'var(--text-primary)',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          lineHeight: 1.3,
        }}
      >
        {name}
      </div>
      {/* Count badge */}
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          lineHeight: 1,
          background: 'rgba(255,255,255,0.05)',
          padding: '1px 6px',
          borderRadius: 'var(--radius-full)',
        }}
      >
        {itemCount}
      </div>
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
