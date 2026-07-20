import { useState, useMemo } from 'react'
import { Search, X, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react'
import {
  getSpecByCategory,
  searchSpecs,
  getGroupedByPrimaryCategory,
} from '../data/specs'
import useStore from '../store/useStore'
import CategoryCard from './CategoryCard'
import PrimaryCategoryTabs from './PrimaryCategoryTabs'
import SpecSection from './SpecSection'
import SpecItemCard from './SpecItemCard'

/** Sub-categories under 室内设计规范 that should be collapsible */
const COLLAPSIBLE_SUBS = new Set(['餐饮工装', '酒店民宿', '家装'])

export default function SidePanel() {
  const addCard = useStore((s) => s.addCard)
  const togglePanel = useStore((s) => s.togglePanel)
  const customSpecs = useStore((s) => s.customSpecs)
  const addCustomSpec = useStore((s) => s.addCustomSpec)
  const deleteCustomSpec = useStore((s) => s.deleteCustomSpec)
  // Re-compute the category tree whenever specs are (re)loaded
  const specVersion = useStore((s) => s.specVersion)
  const specStatus = useStore((s) => s.specStatus)
  const specError = useStore((s) => s.specError)
  const refreshSpecsDataAction = useStore((s) => s.refreshSpecsDataAction)

  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activePrimary, setActivePrimary] = useState('室内设计规范')
  const [searchFocused, setSearchFocused] = useState(false)
  // Collapsed state for sub-categories: { "餐饮工装": false, ... } — false = expanded
  const [collapsedSubs, setCollapsedSubs] = useState(() => ({}))

  const specData = selectedCategory ? getSpecByCategory(selectedCategory) : null

  const grouped = useMemo(() => getGroupedByPrimaryCategory(), [specVersion])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const builtIn = searchSpecs(searchQuery)
    const q = searchQuery.toLowerCase()
    const custom = customSpecs
      .filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.value.toLowerCase().includes(q) ||
          s.note.toLowerCase().includes(q) ||
          s.sectionTitle.toLowerCase().includes(q),
      )
      .map((s) => ({
        ...s,
        categoryName: '自定义规范',
        categoryIcon: '📝',
        sectionTitle: s.sectionTitle,
        isCustom: true,
      }))
    return [...builtIn, ...custom]
  }, [searchQuery, customSpecs, specVersion])

  const toggleSubCollapse = (subKey) => {
    setCollapsedSubs((prev) => ({ ...prev, [subKey]: !prev[subKey] }))
  }

  const handleAddSpecCard = (specItem, sectionTitle) => {
    addCard('spec', {
      width: 220,
      height: 'auto',
      sectionTitle,
      specData: specItem,
    })
  }

  const primaryData = grouped[activePrimary] || {}

  return (
    <div
      className="glass-medium iridescent-border glow-aura-weak"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: 'var(--radius-panel)',
        position: 'relative',
        isolation: 'isolate',
      }}
    >
      {/* Glass optical layers — top refraction line + inner gradient + micro-noise.
          These create the frosted glass illusion on a pure-black canvas where
          backdrop-filter blur has nothing visible to work on. (spec v3.1) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 30%),' +
            'radial-gradient(ellipse 90% 40% at 30% 0%, rgba(110,168,254,0.08), transparent 60%),' +
            'radial-gradient(ellipse 70% 40% at 80% 100%, rgba(167,139,250,0.06), transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Top highlight refraction line */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18) 30%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.18) 70%, transparent)',
          borderRadius: '1px',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      {/* Header */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          gap: 6,
        }}
      >
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          设计规范库
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Error indicator */}
          {specError && (
            <span
              title={`加载失败：${specError.message}\n点击右侧 ↻ 重试`}
              style={{
                color: 'var(--semantic-danger)',
                cursor: 'default',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <AlertCircle size={13} />
            </span>
          )}
          {/* Version badge with category count */}
          <span
            title={`规范数据版本 ${specStatus.version} · 来源：${specStatus.source}${specStatus.categories ? ` · ${specStatus.categories} 个品类` : ''}${specError ? `\n\n⚠ ${specError.message}` : ''}`}
            style={{
              fontSize: 'var(--text-xs)',
              color: specError ? 'var(--semantic-danger)' : 'var(--text-tertiary)',
              fontWeight: 400,
              cursor: 'default',
              padding: '1px 6px',
              borderRadius: 'var(--radius-xs)',
              background: specError ? 'rgba(240,101,72,0.12)' : 'var(--surface-overlay)',
              whiteSpace: 'nowrap',
            }}
          >
            v{specStatus.version}{specStatus.categories ? ` · ${specStatus.categories}类` : ''}
          </span>
          {/* Manual reload button */}
          <button
            onClick={() => refreshSpecsDataAction()}
            title="重新加载规范库"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '2px 3px',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              alignItems: 'center',
              lineHeight: 0,
            }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <button
          onClick={togglePanel}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 'var(--radius-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 150ms ease-out',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Primary Tabs */}
      <div style={{ flexShrink: 0 }}>
        <PrimaryCategoryTabs value={activePrimary} onChange={setActivePrimary} />
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 6px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-overlay)',
            border: searchFocused
              ? '1px solid var(--border-accent)'
              : '1px solid transparent',
            transition: 'all 200ms ease-out',
          }}
        >
          <Search size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="搜索规范（如：过道、排烟、桌型...）"
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
              fontFamily: 'var(--font-family)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
              }}
            >
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {searchQuery.trim() && searchResults ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', padding: '4px 0 8px' }}>
            找到 {searchResults.length} 条结果
          </div>
          {searchResults.map((item, idx) => (
            <SpecItemCard
              key={idx}
              item={item}
              onAdd={() => handleAddSpecCard(item, item.sectionTitle)}
            />
          ))}
        </div>
      ) : !specData ? (
        /* Category list — with collapsible sub-groups */
        <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
          {Object.entries(primaryData).map(([subCategory, cats]) => {
            const isCollapsible = COLLAPSIBLE_SUBS.has(subCategory)
            const isCollapsed = isCollapsible && !!collapsedSubs[subCategory]

            return (
              <div key={subCategory} style={{ marginBottom: 10 }}>
                {/* Sub-category header — clickable if collapsible */}
                <div
                  style={{
                    padding: '6px 0',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: isCollapsible ? 'pointer' : 'default',
                  }}
                  onClick={() => isCollapsible && toggleSubCollapse(subCategory)}
                >
                  {isCollapsible ? (
                    <ChevronDown
                      size={12}
                      strokeWidth={2}
                      style={{
                        flexShrink: 0,
                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        transition: 'transform 250ms var(--ease-out-smooth)',
                      }}
                    />
                  ) : (
                    <span style={{ width: 12 }} /> /* spacer for alignment */
                  )}
                  <span>{subCategory}</span>
                  {isCollapsible && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 2 }}>
                      ({cats.length})
                    </span>
                  )}
                </div>

                {/* Category cards — animated collapse/expand */}
                <div
                  style={{
                    maxHeight: isCollapsed ? 0 : 2000,
                    overflow: 'hidden',
                    opacity: isCollapsed ? 0 : 1,
                    transition: 'max-height 320ms var(--ease-out-smooth), opacity 220ms ease-out',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {cats.map((cat) => (
                      <CategoryCard
                        key={cat.id}
                        id={cat.id}
                        name={cat.name}
                        icon={cat.icon}
                        itemCount={cat.itemCount}
                        isSelected={false}
                        onClick={() => {
                          setSelectedCategory(cat.id)
                          setSearchQuery('')
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Spec detail view */
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface-overlay)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 20 }}>{specData.icon}</span>
            <div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{specData.name}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
                {specData.description}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedCategory(null)
                setSearchQuery('')
              }}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: 'var(--accent-default)',
                cursor: 'pointer',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                padding: '4px 8px',
                borderRadius: 'var(--radius-xs)',
                transition: 'background 150ms ease-out',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-muted)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              ← 返回列表
            </button>
          </div>

          <div style={{ padding: '10px 12px' }}>
            {specData.sections.map((section, idx) => (
              <SpecSection
                key={idx}
                title={section.title}
                itemCount={section.items.length}
              >
                {section.items.map((item, itemIdx) => (
                  <SpecItemCard
                    key={itemIdx}
                    item={item}
                    onAdd={() => handleAddSpecCard(item, section.title)}
                  />
                ))}
              </SpecSection>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
