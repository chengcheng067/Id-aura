/**
 * Parse spec item lines from AI assistant message text.
 * Uses line-by-line parsing to handle multiple formats:
 *
 * Format A: "- **名称**: 值（说明）[优先级]"
 * Format B: "- 名称: 值"  (no bold markers)
 * Format C: "- 若以饮品为主..." (no label:value split, uses fallback label "AI 建议")
 * Format D: "• 主通道宽度 ≥1200mm"  (bullet point, no colon)
 *
 * Titles (starting with #) and blockquotes (starting with >) are skipped.
 *
 * Returns array of { label, value, note, priority } or empty array.
 */
export function parseSpecItems(text) {
  if (!text || typeof text !== 'string') return []
  const items = []
  const lines = text.split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Ignore headings, blockquotes, and horizontal rules
    if (line.startsWith('#')) continue
    if (line.startsWith('>')) continue
    if (line.startsWith('---')) continue

    // Match format A: "- **名称**: 值（说明）[优先级]"
    //          or  "- *名称*: 值"
    const matchA = line.match(/^\s*(?:[-*•]|\d+\.)\s*\*\*?([^:*]+?)\*\*?\s*[:：]\s*(.+)$/)
    if (matchA) {
      const label = matchA[1].trim()
      const rest = matchA[2].trim()
      const noteMatch = rest.match(/^(.*?)[（(](.+?)[)）]\s*(?:\[([^\]]+)\])?$/)
      const value = noteMatch ? noteMatch[1].trim() : rest
      const note = noteMatch ? noteMatch[2].trim() : ''
      const priority = noteMatch && noteMatch[3] ? noteMatch[3].trim() : 'medium'
      items.push({ label, value, note, priority })
      continue
    }

    // Match format B: "- 常见做法：可放宽至1.2㎡/人" (no ** bold markers, but has colon)
    const matchB = line.match(/^\s*(?:[-*•]|\d+\.)\s*([^：:]+?)\s*[:：]\s*(.+)$/)
    if (matchB) {
      const label = matchB[1].trim()
      const value = matchB[2].trim()
      items.push({ label, value, note: '', priority: 'medium' })
      continue
    }

    // Match format C/D: bullet point without colon
    //   - "若以饮品为主（简餐少），可放宽至1.2㎡/人 → 约83位"
    //   • "主通道宽度 ≥1200mm"
    const matchC = line.match(/^\s*(?:[-*•]|\d+\.)\s*(.+)$/)
    if (matchC) {
      const value = matchC[1].trim()
      // Avoid capturing short fragments or style-only lines
      if (value.length >= 6 && !value.startsWith('注意') && !value.startsWith('例如')) {
        items.push({ label: 'AI 建议', value, note: '', priority: 'medium' })
      }
      continue
    }
  }

  return items
}

/**
 * Map Chinese/English priority strings to normalized values.
 */
export function mapPriority(p) {
  const s = String(p).toLowerCase()
  if (s.includes('高') || s.includes('high')) return 'high'
  if (s.includes('低') || s.includes('low')) return 'low'
  return 'medium'
}

/**
 * Build a spec card payload from a parsed item and pass it to addCard.
 */
export function addSpecCardFromAi(addCardFn, item) {
  addCardFn('spec', {
    width: 220,
    height: 'auto',
    sectionTitle: 'AI 推荐规范',
    specData: {
      label: item.label,
      value: item.value,
      note: item.note,
      priority: mapPriority(item.priority),
    },
  })
}
