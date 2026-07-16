// 把根目录 spec.json 导出为 specs.csv，可用 Excel 打开做批量编辑。
// 导出为「一条规范一行」的扁平表，包含品类级字段（每行重复）。
//   用法: node scripts/json-to-csv.mjs [输出文件名.csv]
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const inP = resolve(root, 'spec.json')
const outP = resolve(root, process.argv[2] || 'specs.csv')

const spec = JSON.parse(readFileSync(inP, 'utf8'))

const esc = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

const header = ['categoryId', 'category', 'subCategory', 'name', 'icon', 'description', 'sectionTitle', 'label', 'value', 'note', 'priority']
const rows = [header.join(',')]

for (const [id, cat] of Object.entries(spec.data)) {
  for (const sec of cat.sections || []) {
    for (const it of sec.items || []) {
      rows.push([
        id, cat.category, cat.subCategory, cat.name, cat.icon, cat.description,
        sec.title, it.label, it.value, it.note, it.priority,
      ].map(esc).join(','))
    }
  }
}

// 写 BOM，保证 Excel 打开中文不乱码
writeFileSync(outP, '﻿' + rows.join('\n'))
console.log(`✅ 已导出 ${rows.length - 1} 条规范到 ${outP}（可用 Excel 打开编辑）`)
