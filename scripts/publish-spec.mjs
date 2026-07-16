// 规范库自动发布脚本：校验 → 规范化 → 提交 → 推送到 GitHub → 刷新 jsDelivr 缓存。
//
// 用法:
//   node scripts/publish-spec.mjs --msg="chore(spec): 增补火锅店排烟规范"
//   node scripts/publish-spec.mjs --dry-run                # 只校验，不提交/推送
//   node scripts/publish-spec.mjs --version-check-only     # 仅检查版本是否比上次大
//
// 前置: 先把 spec.json 里的 version 改成比上一次更大的值（如 1.0.0 → 1.0.1）。
// 安全: 不要把 GitHub 令牌写进本文件；用 `gh auth login` 或系统凭据即可推送。
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const specP = resolve(root, 'spec.json')
const SPEC_PATH = 'spec.json'
const REPO = 'chengcheng067/Id-aura'

const dryRun = process.argv.includes('--dry-run')
const versionCheckOnly = process.argv.includes('--version-check-only')

const PRIORITY = ['high', 'medium', 'low']

function fail(msg) { console.error('❌ ' + msg); process.exit(1) }

// 1) 解析 JSON
let spec
try { spec = JSON.parse(readFileSync(specP, 'utf8')) }
catch (e) { fail('spec.json 不是合法 JSON：' + e.message) }

// 2) 结构校验
if (!spec.version || !/^\d+\.\d+\.\d+$/.test(spec.version)) fail('version 必须是 x.y.z 格式，当前：' + spec.version)
if (!spec.data || typeof spec.data !== 'object') fail('缺少顶层 data 对象')

const errors = []
for (const [id, cat] of Object.entries(spec.data)) {
  for (const f of ['name', 'category', 'subCategory', 'icon', 'description']) {
    if (!cat[f] || !String(cat[f]).trim()) errors.push(`品类「${id}」缺少字段 ${f}`)
  }
  if (!Array.isArray(cat.sections)) {
    errors.push(`品类「${id}」的 sections 不是数组`)
  } else {
    cat.sections.forEach((sec, i) => {
      if (!sec.title) errors.push(`品类「${id}」第 ${i} 个 section 缺少 title`)
      if (!Array.isArray(sec.items)) {
        errors.push(`品类「${id}」section「${sec.title}」的 items 不是数组`)
      } else {
        sec.items.forEach((it, j) => {
          for (const f of ['label', 'value', 'note']) {
            if (!it[f] || !String(it[f]).trim()) errors.push(`品类「${id}」/ ${sec.title} / 第 ${j} 条缺少 ${f}`)
          }
          if (!PRIORITY.includes(it.priority)) {
            errors.push(`品类「${id}」/ ${sec.title} / 第 ${j} 条 priority 必须是 high/medium/low，当前="${it.priority}"`)
          }
        })
      }
    })
  }
}
if (errors.length) fail('结构校验未通过：\n- ' + errors.join('\n- '))

// 3) 版本号必须比上一次提交更大
function cmp(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1
    if (pa[i] < pb[i]) return -1
  }
  return 0
}
let prev = '0.0.0'
try { prev = JSON.parse(execSync(`git show HEAD:${SPEC_PATH}`, { cwd: root }).toString()).version } catch {}
console.log(`🔍 版本校验：${prev} → ${spec.version}`)
if (cmp(spec.version, prev) <= 0) fail(`版本号必须比上一次提交（${prev}）更大，请先把 spec.json 的 version 升一档再发布。`)
if (versionCheckOnly) { console.log('✅ 版本号已递增，校验通过。'); process.exit(0) }

// 4) 演练模式：只校验，不改动/不推送
if (dryRun) {
  console.log(`🟡 演练完成（未提交/推送）。移除 --dry-run 可真正发布。规范条数：${Object.keys(spec.data).length}`)
  process.exit(0)
}

// 5) 规范化（统一为 2 空格缩进的多行 JSON）
writeFileSync(specP, JSON.stringify(spec, null, 2))
console.log(`📝 已规范化 spec.json（${Object.keys(spec.data).length} 品类）`)

// 6) 提交 + 推送
const msg = process.argv.find((a) => a.startsWith('--msg='))?.split('=').slice(1).join('=') || `chore(spec): 更新规范库至 v${spec.version}`
const msgFile = resolve(root, '.spec-commit-msg')
writeFileSync(msgFile, msg)
try {
  execSync(`git add ${SPEC_PATH}`, { cwd: root })
  execSync(`git commit -F "${msgFile}"`, { cwd: root })
  execSync('git push origin main', { cwd: root })
} finally {
  try { execSync(`rm -f "${msgFile}"`, { cwd: root }) } catch {}
}
console.log('🚀 已提交并推送到 GitHub (main)。')

// 7) 刷新 jsDelivr 缓存（让用户尽快拿到）
try {
  const out = execSync(`curl -s -X GET "https://purge.jsdelivr.net/gh/${REPO}@main/${SPEC_PATH}"`).toString()
  console.log('🌐 jsDelivr 缓存刷新：' + out)
} catch {
  console.log('⚠️ jsDelivr 缓存刷新跳过（不影响，jsDelivr 通常几分钟内自动更新）。')
}

console.log(`✅ 发布完成 v${spec.version}。用户下次打开 ID Aura 会自动拉取更新。`)
