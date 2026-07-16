// 把根目录 spec.json 重新格式化为可读的多行 JSON（方便人工编辑）。
// 仅改变排版，不改变任何内容。
//   用法: node scripts/beautify-spec.mjs
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const p = resolve(root, 'spec.json')
const spec = JSON.parse(readFileSync(p, 'utf8'))
writeFileSync(p, JSON.stringify(spec, null, 2))
console.log('✅ spec.json 已格式化为可读的多行 JSON。')
