// 把编辑好的 specs.csv 导入回 spec.json（全量替换 data，保留版本号）。
// 适合「导出 CSV → Excel 编辑 → 导入」的批量工作流。
//   用法: node scripts/specs-csv-to-json.mjs [输入.csv] [--version=1.2.0]
//
// 解析规则: 按 categoryId 聚合成品类，按 sectionTitle 聚合成分组；
// 品类级字段取第一次出现的值；version 默认沿用现有 spec.json，可用 --version 覆盖。
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const csvP = resolve(root, process.argv[2] || 'specs.csv')
const outP = resolve(root, 'spec.json')
const versionArg = process.argv.find((a) => a.startsWith('--version='))
const newVersion = versionArg ? versionArg.split('=')[1] : null

// 极简 CSV 解析（支持引号字段与转义引号 ""）
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += ch
    } else {
      if (ch === '"') inQ = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (ch === '\r') { /* 忽略 */ } else field += ch
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

const text = readFileSync(csvP, 'utf8').replace(/^﻿/, '')
const rows = parseCsv(text)
const header = rows.shift().map((h) => h.trim())
const idx = (name) => header.indexOf(name)

const data = {}
for (const r of rows) {
  if (r.every((c) => (c || '').trim() === '')) continue
  const get = (n) => (idx(n) >= 0 ? (r[idx(n)] || '').trim() : '')
  const id = get('categoryId')
  if (!id) continue
  if (!data[id]) {
    data[id] = {
      name: get('name'),
      category: get('category'),
      subCategory: get('subCategory'),
      icon: get('icon'),
      description: get('description'),
      sections: [],
    }
  }
  const secTitle = get('sectionTitle')
  let sec = data[id].sections.find((s) => s.title === secTitle)
  if (!sec) { sec = { title: secTitle, items: [] }; data[id].sections.push(sec) }
  sec.items.push({
    label: get('label'),
    value: get('value'),
    note: get('note'),
    priority: get('priority') || 'medium',
  })
}

let version = newVersion
if (!version && existsSync(outP)) {
  try { version = JSON.parse(readFileSync(outP, 'utf8')).version } catch {}
}
version = version || '0.0.0'
writeFileSync(outP, JSON.stringify({ version, data }, null, 2))
console.log(`✅ 已从 ${csvP} 导入 ${Object.keys(data).length} 个品类到 spec.json（版本 ${version}）`)
