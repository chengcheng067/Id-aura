/**
 * Unit tests for parseSpecItems utility.
 * Covers: parseSpecItems, mapPriority, addSpecCardFromAi
 *
 * Format:  - **label**: value（note）[priority]
 *          1. **label**: value
 */
import { describe, it, expect, vi } from 'vitest'
import { parseSpecItems, mapPriority, addSpecCardFromAi } from './parseSpecItems'

// ==================== parseSpecItems ====================
describe('parseSpecItems', () => {
  it('should parse a simple spec line with bold label', () => {
    const text = '- **主通道宽度**: ≥1200mm'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      label: '主通道宽度',
      value: '≥1200mm',
      note: '',
      priority: 'medium',
    })
  })

  it('should parse a spec line with note in parentheses', () => {
    const text = '- **厨房面积**: ≥30㎡（不含库房）'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      label: '厨房面积',
      value: '≥30㎡',
      note: '不含库房',
      priority: 'medium',
    })
  })

  it('should parse a spec line with note and priority', () => {
    const text = '- **排烟量**: ≥2000m³/h（每灶头）[高优先级]'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      label: '排烟量',
      value: '≥2000m³/h',
      note: '每灶头',
      priority: '高优先级',
    })
  })

  it('should parse numbered list items', () => {
    const text = '1. **主通道宽度**: ≥1200mm'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('主通道宽度')
    expect(items[0].value).toBe('≥1200mm')
  })

  it('should parse lines with single asterisk', () => {
    const text = '- *照度标准*: 300lx'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('照度标准')
    expect(items[0].value).toBe('300lx')
  })

  it('should parse Chinese colon separator', () => {
    const text = '- **开口率**：≥65%'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('开口率')
    expect(items[0].value).toBe('≥65%')
  })

  it('should parse multiple lines into multiple items', () => {
    const text = [
      '- **主通道宽度**: ≥1200mm',
      '- **次通道宽度**: ≥900mm',
      '- **消防通道**: ≥1500mm（含喷淋）[高优先级]',
    ].join('\n')
    const items = parseSpecItems(text)
    expect(items).toHaveLength(3)
    expect(items[0].label).toBe('主通道宽度')
    expect(items[1].label).toBe('次通道宽度')
    expect(items[2].label).toBe('消防通道')
    expect(items[2].note).toBe('含喷淋')
    expect(items[2].priority).toBe('高优先级')
  })

  it('should handle Chinese parentheses for notes', () => {
    const text = '- **层高**: ≥3.6m（净高≥2.8m）'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].value).toBe('≥3.6m')
    expect(items[0].note).toBe('净高≥2.8m')
  })

  it('should handle English parentheses for notes', () => {
    const text = '- **层高**: ≥3.6m(净高≥2.8m)'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].value).toBe('≥3.6m')
    expect(items[0].note).toBe('净高≥2.8m')
  })

  it('should handle value with no note or priority', () => {
    const text = '- **用餐区面积**: ≥100㎡'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      label: '用餐区面积',
      value: '≥100㎡',
      note: '',
      priority: 'medium',
    })
  })

  it('should return empty array for null input', () => {
    expect(parseSpecItems(null)).toEqual([])
  })

  it('should return empty array for undefined input', () => {
    expect(parseSpecItems(undefined)).toEqual([])
  })

  it('should return empty array for empty string', () => {
    expect(parseSpecItems('')).toEqual([])
  })

  it('should return empty array for non-string input', () => {
    expect(parseSpecItems(123)).toEqual([])
    expect(parseSpecItems({})).toEqual([])
    expect(parseSpecItems([])).toEqual([])
  })

  it('should return empty array for text with no matching lines', () => {
    const text = '这是一段普通文本，没有规范条目格式。'
    expect(parseSpecItems(text)).toEqual([])
  })

  it('should handle mixed text — only lines with spec format are parsed', () => {
    const text = [
      '以下是规范建议：',
      '- **主通道宽度**: ≥1200mm（主要通道）',
      '注意：以上数值为最低要求。',
      '- **次通道宽度**: ≥900mm',
    ].join('\n')
    const items = parseSpecItems(text)
    expect(items).toHaveLength(2)
    expect(items[0].label).toBe('主通道宽度')
    expect(items[1].label).toBe('次通道宽度')
  })

  it('should trim whitespace from label and value', () => {
    const text = '- **  测试标签  **:   测试值  '
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('测试标签')
    expect(items[0].value).toBe('测试值')
  })

  it('should handle line with priority brackets but no note — brackets stay in value', () => {
    const text = '- **安全出口**: ≥2个[高优先级]'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    // Without parentheses, the noteMatch regex doesn't split, so the
    // entire rest becomes the value, priority defaults to 'medium'.
    expect(items[0].value).toBe('≥2个[高优先级]')
    expect(items[0].note).toBe('')
    expect(items[0].priority).toBe('medium')
  })

  // ─── New format tests (v2.7.6) ──────────────────────────────

  it('should parse format B: "- 常见做法：可放宽至1.2㎡/人" (no bold)', () => {
    const text = '- 常见做法：可放宽至1.2㎡/人'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('常见做法')
    expect(items[0].value).toBe('可放宽至1.2㎡/人')
    expect(items[0].note).toBe('')
    expect(items[0].priority).toBe('medium')
  })

  it('should parse format C: "- 若以饮品为主..." as AI 建议', () => {
    const text = '- 若以饮品为主（简餐少），可放宽至1.2㎡/人 → 约83位'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('AI 建议')
    expect(items[0].value).toBe('若以饮品为主（简餐少），可放宽至1.2㎡/人 → 约83位')
    expect(items[0].note).toBe('')
    expect(items[0].priority).toBe('medium')
  })

  it('should parse format D: "• 主通道宽度 ≥1200mm" (bullet, no colon)', () => {
    const text = '• 主通道宽度 ≥1200mm'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('AI 建议')
    expect(items[0].value).toBe('主通道宽度 ≥1200mm')
  })

  it('should handle "•" bullet with colon like format A', () => {
    const text = '• **主通道宽度**: ≥1200mm'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].label).toBe('主通道宽度')
    expect(items[0].value).toBe('≥1200mm')
  })

  it('should skip title lines starting with #', () => {
    const text = '### 2. 厨房与餐位配比（面积分配）'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(0)
  })

  it('should skip blockquotes starting with >', () => {
    const text = '> 注意：以上为标准最小值'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(0)
  })

  it('should skip short bullet points (< 6 chars)', () => {
    const text = '- 注意'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(0)
  })

  it('should skip lines starting with "注意" as fallback', () => {
    const text = '- 注意：以上数值为最低要求'
    const items = parseSpecItems(text)
    expect(items).toHaveLength(1)
    // This has colon so format B matches first
    expect(items[0].label).toBe('注意')
    expect(items[0].value).toBe('以上数值为最低要求')
  })

  it('should handle mixed formats in one text block', () => {
    const text = [
      '以下是规范建议：',
      '- **主通道宽度**: ≥1200mm（主要通道）[高优先级]',
      '- 常见做法：可放宽至1.2㎡/人',
      '### 2. 厨房与餐位配比（面积分配）',
      '- 若以饮品为主（简餐少），可放宽至1.2㎡/人 → 约83位',
    ].join('\n')
    const items = parseSpecItems(text)
    expect(items).toHaveLength(3)
    expect(items[0].label).toBe('主通道宽度')
    expect(items[0].value).toBe('≥1200mm')
    expect(items[1].label).toBe('常见做法')
    expect(items[1].value).toBe('可放宽至1.2㎡/人')
    expect(items[2].label).toBe('AI 建议')
    expect(items[2].value).toContain('若以饮品为主')
  })
})

// ==================== mapPriority ====================
describe('mapPriority', () => {
  it('should map 高 to high', () => {
    expect(mapPriority('高')).toBe('high')
  })

  it('should map 高优先级 to high', () => {
    expect(mapPriority('高优先级')).toBe('high')
  })

  it('should map high to high', () => {
    expect(mapPriority('high')).toBe('high')
  })

  it('should map HIGH to high', () => {
    expect(mapPriority('HIGH')).toBe('high')
  })

  it('should map 低 to low', () => {
    expect(mapPriority('低')).toBe('low')
  })

  it('should map 低优先级 to low', () => {
    expect(mapPriority('低优先级')).toBe('low')
  })

  it('should map low to low', () => {
    expect(mapPriority('low')).toBe('low')
  })

  it('should map LOW to low', () => {
    expect(mapPriority('LOW')).toBe('low')
  })

  it('should map medium to medium', () => {
    expect(mapPriority('medium')).toBe('medium')
  })

  it('should map 中 to medium', () => {
    expect(mapPriority('中')).toBe('medium')
  })

  it('should map empty string to medium', () => {
    expect(mapPriority('')).toBe('medium')
  })

  it('should map unknown value to medium', () => {
    expect(mapPriority('urgent')).toBe('medium')
  })

  it('should handle non-string input', () => {
    expect(mapPriority(null)).toBe('medium')
    expect(mapPriority(undefined)).toBe('medium')
    expect(mapPriority(123)).toBe('medium')
  })
})

// ==================== addSpecCardFromAi ====================
describe('addSpecCardFromAi', () => {
  it('should call addCard with spec type and correct fields', () => {
    const addCard = vi.fn()
    const item = {
      label: '主通道宽度',
      value: '≥1200mm',
      note: '主要通道',
      priority: '高优先级',
    }

    addSpecCardFromAi(addCard, item)

    expect(addCard).toHaveBeenCalledTimes(1)
    expect(addCard).toHaveBeenCalledWith('spec', {
      width: 220,
      height: 'auto',
      sectionTitle: 'AI 推荐规范',
      specData: {
        label: '主通道宽度',
        value: '≥1200mm',
        note: '主要通道',
        priority: 'high',
      },
    })
  })

  it('should call addCard with medium priority for items without priority', () => {
    const addCard = vi.fn()
    const item = {
      label: '照度标准',
      value: '300lx',
      note: '',
      priority: 'medium',
    }

    addSpecCardFromAi(addCard, item)

    expect(addCard).toHaveBeenCalledWith('spec', {
      width: 220,
      height: 'auto',
      sectionTitle: 'AI 推荐规范',
      specData: {
        label: '照度标准',
        value: '300lx',
        note: '',
        priority: 'medium',
      },
    })
  })

  it('should map low priority correctly', () => {
    const addCard = vi.fn()
    const item = {
      label: '备用出口',
      value: '≥1个',
      note: '',
      priority: '低优先级',
    }

    addSpecCardFromAi(addCard, item)

    expect(addCard).toHaveBeenCalledWith('spec', expect.objectContaining({
      specData: expect.objectContaining({ priority: 'low' }),
    }))
  })
})
