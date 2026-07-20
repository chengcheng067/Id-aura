
const PRIMARY_TABS = [
  { key: '建筑设计规范', label: '建筑' },
  { key: '室内设计规范', label: '室内' },
  { key: '景观设计规范', label: '景观' },
]

export default function PrimaryCategoryTabs({ value, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
        {PRIMARY_TABS.map((tab) => {
          const active = value === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 'var(--radius-pill)',
                border: active
                  ? '1px solid var(--accent-default)'
                  : '1px solid transparent',
                background: active ? 'var(--accent-muted)' : 'transparent',
                color: active ? 'var(--accent-default)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-xs)',
                fontWeight: active ? 600 : 500,
                fontFamily: 'var(--font-family)',
                transition: 'all 200ms var(--ease-out-smooth)',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--hover-faint)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
