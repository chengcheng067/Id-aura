import { useState, useMemo } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
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

  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activePrimary, setActivePrimary] = useState('室内设计规范')
  const [searchFocused, setSearchFocused] = useState(false)
  // Collapsed state for sub-categories: { "餐饮工装": false, ... } — false = expanded
  const [collapsedSubs, setCollapsedSubs] = useState(() => ({}))

  const specData = selectedCategory ? getSpecByCategory(selectedCategory) : null

  const grouped = useMemo(() => getGroupedByPrimaryCategory(), [])

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
  }, [searchQuery, customSpecs])

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
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
        overflow: 'hidden',
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--shadow-panel)',
        position: 'relative',
        isolation: 'isolate',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          设计规范库
        </span>
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
                    maxHeight: isCollapsed ? 0 : 1200,
                    overflow: 'hidden',
                    opacity: isCollapsed ? 0 : 1,
                    transition: 'max-height 320ms var(--ease-out-smooth), opacity 220ms ease-out',
                  }}
                >
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
