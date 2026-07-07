import { useState, useMemo } from 'react'
import { X, Palette, FileText, Monitor, Keyboard, Heart, Bot, LayoutTemplate } from 'lucide-react'
import useStore from '../store/useStore'
import { testConnection } from '../utils/aiClient'
import packageJson from '../../package.json'

/** Tab definitions */
const TABS = [
  { key: 'canvas', label: '画布', icon: Palette },
  { key: 'file', label: '文件', icon: FileText },
  { key: 'display', label: '显示', icon: Monitor },
  { key: 'shortcuts', label: '快捷键', icon: Keyboard },
  { key: 'toolbar', label: '工具栏', icon: LayoutTemplate },
  { key: 'ai', label: 'AI 助手', icon: Bot },
  { key: 'about', label: '关于', icon: Heart },
]

/** Keyboard shortcut reference table (read-only for v2.7) */
const SHORTCUT_TABLE = [
  { action: '设置', keys: 'Ctrl+,' },
  { action: '撤销', keys: 'Ctrl+Z' },
  { action: '重做', keys: 'Ctrl+Shift+Z' },
  { action: '编组', keys: 'Ctrl+G' },
  { action: '取消编组', keys: 'Ctrl+Shift+G' },
  { action: '粘贴', keys: 'Ctrl+V' },
  { action: '保存', keys: 'Ctrl+S' },
  { action: '打开', keys: 'Ctrl+O' },
  { action: '删除', keys: 'Delete' },
  { action: '退出', keys: 'Esc' },
]

/** Shared label style */
const labelS = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  marginBottom: 4,
  display: 'block',
  fontWeight: 500,
}

/** Shared select style */
const selectS = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 'var(--radius-xs)',
  border: '1px solid var(--border-default)',
  background: 'var(--surface-base)',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  outline: 'none',
  fontFamily: 'var(--font-family)',
  cursor: 'pointer',
}

/** Shared slider style */
function sliderStyle() {
  return {
    width: '100%',
    accentColor: 'var(--accent-default)',
    cursor: 'pointer',
  }
}

/** Shared input style */
const inputS = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 'var(--radius-xs)',
  border: '1px solid var(--border-default)',
  background: 'var(--surface-base)',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  outline: 'none',
  fontFamily: 'var(--font-family)',
}

/** Checkbox + label row */
function CheckRow({ label, checked, onChange, disabled }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={{ accentColor: 'var(--accent-default)', cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
        {label}
      </span>
    </label>
  )
}

// ─── Canvas Tab ──────────────────────────────────────────────

function CanvasTab() {
  const settings = useStore((s) => s.settings)
  const updateCanvasSettings = useStore((s) => s.updateCanvasSettings)
  const canvas = settings.canvas

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Pattern selector */}
      <div>
        <label style={labelS}>背景模式</label>
        <select
          value={canvas.pattern}
          onChange={(e) => updateCanvasSettings({ pattern: e.target.value })}
          style={selectS}
        >
          <option value="dots">点状</option>
          <option value="grid">网格</option>
          <option value="solid">纯色</option>
        </select>
      </div>

      {/* Dots parameters */}
      {canvas.pattern === 'dots' && (
        <>
          <SliderRow
            label={`点大小: ${canvas.dotSize.toFixed(1)}px`}
            value={canvas.dotSize}
            min={0.5}
            max={4}
            step={0.1}
            onChange={(v) => updateCanvasSettings({ dotSize: v })}
          />
          <SliderRow
            label={`点间距: ${canvas.dotSpacing}px`}
            value={canvas.dotSpacing}
            min={10}
            max={60}
            step={1}
            onChange={(v) => updateCanvasSettings({ dotSpacing: v })}
          />
        </>
      )}

      {/* Grid parameters */}
      {canvas.pattern === 'grid' && (
        <>
          <SliderRow
            label={`线宽: ${canvas.lineWidth.toFixed(1)}px`}
            value={canvas.lineWidth}
            min={0.5}
            max={3}
            step={0.1}
            onChange={(v) => updateCanvasSettings({ lineWidth: v })}
          />
          <SliderRow
            label={`网格间距: ${canvas.gridSpacing}px`}
            value={canvas.gridSpacing}
            min={10}
            max={80}
            step={1}
            onChange={(v) => updateCanvasSettings({ gridSpacing: v })}
          />
        </>
      )}

      {/* Common parameters */}
      <SliderRow
        label={`透明度: ${(canvas.bgOpacity * 100).toFixed(0)}%`}
        value={canvas.bgOpacity}
        min={0.02}
        max={0.15}
        step={0.01}
        onChange={(v) => updateCanvasSettings({ bgOpacity: v })}
      />
      <div>
        <label style={labelS}>背景色</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="color"
            value={canvas.bgColor}
            onChange={(e) => updateCanvasSettings({ bgColor: e.target.value })}
            style={{
              width: 32,
              height: 32,
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              padding: 0,
              background: 'none',
            }}
          />
          <input
            type="text"
            value={canvas.bgColor}
            onChange={(e) => updateCanvasSettings({ bgColor: e.target.value })}
            style={{ ...inputS, width: 100, fontFamily: 'monospace' }}
          />
        </div>
      </div>
    </div>
  )
}

/** Label + range slider + value display row */
function SliderRow({ label, value, min, max, step, onChange }) {
  return (
    <div>
      <label style={labelS}>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={sliderStyle()}
      />
    </div>
  )
}

// ─── File Tab ────────────────────────────────────────────────

function FileTab() {
  const settings = useStore((s) => s.settings)
  const updateFileSettings = useStore((s) => s.updateFileSettings)
  const file = settings.file

  const intervalOptions = [
    { value: 0, label: '关' },
    { value: 15000, label: '15s' },
    { value: 30000, label: '30s' },
    { value: 60000, label: '1min' },
    { value: 180000, label: '3min' },
  ]

  const startupOptions = [
    { value: 'welcome', label: '欢迎页' },
    { value: 'last', label: '继续上次' },
    { value: 'new', label: '新建空白' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelS}>自动保存间隔</label>
        <select
          value={file.autoSaveInterval}
          onChange={(e) => updateFileSettings({ autoSaveInterval: Number(e.target.value) })}
          style={selectS}
        >
          {intervalOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelS}>启动行为</label>
        <select
          value={file.startupBehavior}
          onChange={(e) => updateFileSettings({ startupBehavior: e.target.value })}
          style={selectS}
        >
          {startupOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <CheckRow
        label="关闭前确认"
        checked={file.confirmBeforeClose}
        onChange={(e) => updateFileSettings({ confirmBeforeClose: e.target.checked })}
      />
    </div>
  )
}

// ─── Display Tab ─────────────────────────────────────────────

function DisplayTab() {
  const settings = useStore((s) => s.settings)
  const updateDisplaySettings = useStore((s) => s.updateDisplaySettings)
  const display = settings.display

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelS}>语言</label>
        <select
          value={display.language}
          onChange={(e) => updateDisplaySettings({ language: e.target.value })}
          style={selectS}
        >
          <option value="zh-CN">中文</option>
          <option value="en" disabled>English — v2.5</option>
        </select>
      </div>
      <CheckRow
        label="跳过欢迎页"
        checked={display.skipWelcome}
        onChange={(e) => updateDisplaySettings({ skipWelcome: e.target.checked })}
      />
    </div>
  )
}

// ─── Shortcuts Tab ───────────────────────────────────────────

function ShortcutsTab() {
  return (
    <div style={{ overflowY: 'auto', maxHeight: 300 }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-sm)',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
            <th style={thStyle}>功能</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>快捷键</th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUT_TABLE.map((row, i) => (
            <tr
              key={i}
              style={{
                borderBottom: i < SHORTCUT_TABLE.length - 1 ? '1px solid var(--border-default)' : 'none',
              }}
            >
              <td style={tdStyle}>{row.action}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent-default)' }}>
                {row.keys}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thStyle = {
  textAlign: 'left',
  padding: '8px 0',
  color: 'var(--text-tertiary)',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const tdStyle = {
  padding: '8px 0',
  color: 'var(--text-primary)',
}

// ─── Toolbar Tab ─────────────────────────────────────────────

const TOOLBAR_ITEMS = [
  { id: 'alwaysOnTop', label: '窗口置顶' },
  { id: 'undo', label: '撤销' },
  { id: 'redo', label: '重做' },
  { id: 'panel', label: '规范库' },
  { id: 'addImage', label: '添加图片' },
  { id: 'urlImport', label: 'URL 导入' },
  { id: 'note', label: '备注' },
  { id: 'label', label: '标签' },
  { id: 'paste', label: '粘贴' },
  { id: 'draw', label: '绘制' },
  { id: 'save', label: '保存' },
  { id: 'open', label: '打开' },
  { id: 'export', label: '导出' },
  { id: 'clear', label: '清空' },
  { id: 'settings', label: '设置' },
  { id: 'cardCount', label: '卡片计数' },
]

function ToolbarTab() {
  const settings = useStore((s) => s.settings)
  const updateToolbarSettings = useStore((s) => s.updateToolbarSettings)
  const visible = new Set(settings.toolbar?.visible || TOOLBAR_ITEMS.map((i) => i.id))

  const toggle = (id) => {
    const next = new Set(visible)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    updateToolbarSettings({ visible: Array.from(next) })
  }

  const allVisible = TOOLBAR_ITEMS.every((item) => visible.has(item.id))
  const toggleAll = () => {
    updateToolbarSettings({ visible: allVisible ? [] : TOOLBAR_ITEMS.map((i) => i.id) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
          选择要在工具栏显示的功能
        </span>
        <button
          onClick={toggleAll}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--accent-default)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 0',
          }}
        >
          {allVisible ? '全部隐藏' : '全部显示'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
        {TOOLBAR_ITEMS.map((item) => (
          <CheckRow
            key={item.id}
            label={item.label}
            checked={visible.has(item.id)}
            onChange={() => toggle(item.id)}
          />
        ))}
      </div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
        提示：Logo、折叠按钮和分隔线始终显示。精简工具栏后窗口更清爽。
      </p>
    </div>
  )
}

// ─── About Tab ───────────────────────────────────────────────

function AboutTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      {/* App info */}
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          ID Aura
        </h3>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          v{packageJson.version} · 面向餐饮工装设计师的灵感图版工具
        </p>
      </div>

      {/* Author info */}
      <div
        className="glass-strong iridescent-border"
        style={{
          borderRadius: 'var(--radius-panel)',
          padding: '12px 16px',
          width: '100%',
          textAlign: 'center',
          background: 'var(--surface-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4 }}>
          作者
        </p>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', fontWeight: 500 }}>
          杨雯丞 & WorkBuddy 团队
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          本软件为开源项目，遵循 MIT 协议
        </p>
      </div>

      {/* QR codes row */}
      <div style={{ display: 'flex', gap: 16, width: '100%' }}>
        {/* Donate */}
        <div
          className="glass-medium"
          style={{
            flex: 1,
            borderRadius: 'var(--radius-card)',
            padding: 12,
            textAlign: 'center',
            background: 'var(--surface-card)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 8 }}>
            💚 赞赏支持
          </p>
          <img
            src="./assets/donate-wechat.jpg"
            alt="微信赞赏码"
            style={{
              width: '100%',
              maxWidth: 160,
              borderRadius: 'var(--radius-xs)',
              display: 'block',
              margin: '0 auto',
            }}
          />
        </div>
        {/* Feedback */}
        <div
          className="glass-medium"
          style={{
            flex: 1,
            borderRadius: 'var(--radius-card)',
            padding: 12,
            textAlign: 'center',
            background: 'var(--surface-card)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 8 }}>
            💬 反馈建议
          </p>
          <img
            src="./assets/feedback-wechat.jpg"
            alt="作者微信"
            style={{
              width: '100%',
              maxWidth: 160,
              borderRadius: 'var(--radius-xs)',
              display: 'block',
              margin: '0 auto',
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── AI Providers ──────────────────────────────────────────

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  { id: 'deepseek', name: '深度求索 / DeepSeek', endpoint: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { id: 'moonshot', name: 'Kimi / Moonshot', endpoint: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
  { id: 'qwen', name: '阿里云通义 / Qwen', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
  { id: 'glm', name: '智谱清言 / GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
  { id: 'ollama', name: 'Ollama 本地', endpoint: 'http://localhost:11434/v1', defaultModel: 'llama3' },
  { id: 'custom', name: '自定义 / Custom', endpoint: '', defaultModel: '' },
]

/** Find the provider id that matches the current endpoint, default to 'custom'. */
function findProviderId(endpoint) {
  if (!endpoint) return 'custom'
  const matched = AI_PROVIDERS.find((p) => p.id !== 'custom' && endpoint.startsWith(p.endpoint))
  return matched ? matched.id : 'custom'
}

// ─── AI Tab ───────────────────────────────────────────────

function AiTab() {
  const settings = useStore((s) => s.settings)
  const updateAiSettings = useStore((s) => s.updateAiSettings)
  const ai = settings.ai
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showKey, setShowKey] = useState(false)

  // Derive initial provider from current endpoint
  const initialProviderId = useMemo(() => findProviderId(ai.apiEndpoint), [])
  const [selectedProvider, setSelectedProvider] = useState(initialProviderId)

  const handleProviderChange = (providerId) => {
    setSelectedProvider(providerId)
    if (providerId !== 'custom') {
      const provider = AI_PROVIDERS.find((p) => p.id === providerId)
      if (provider) {
        updateAiSettings({
          apiEndpoint: provider.endpoint,
          modelName: provider.defaultModel,
        })
      }
    }
    // 'custom' — leave existing values as-is
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection({
      apiEndpoint: ai.apiEndpoint,
      apiKey: ai.apiKey,
      modelName: ai.modelName,
    })
    setTestResult(result)
    setTesting(false)
    if (result.success) {
      updateAiSettings({ lastTested: Date.now() })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Provider selector */}
      <div>
        <label style={labelS}>提供商 *</label>
        <select
          value={selectedProvider}
          onChange={(e) => handleProviderChange(e.target.value)}
          style={selectS}
        >
          {AI_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelS}>API 端点 *</label>
        <input
          type="text"
          value={ai.apiEndpoint}
          onChange={(e) => updateAiSettings({ apiEndpoint: e.target.value })}
          placeholder="https://api.openai.com/v1"
          style={inputS}
        />
      </div>
      <div>
        <label style={labelS}>API Key *</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={ai.apiKey}
            onChange={(e) => updateAiSettings({ apiKey: e.target.value })}
            placeholder="sk-..."
            style={{ ...inputS, flex: 1 }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-family)',
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>
      </div>
      <div>
        <label style={labelS}>模型名称 *</label>
        <input
          type="text"
          value={ai.modelName}
          onChange={(e) => updateAiSettings({ modelName: e.target.value })}
          placeholder="gpt-4o-mini"
          style={inputS}
        />
      </div>

      {/* Test connection button */}
      <button
        onClick={handleTest}
        disabled={testing || !ai.apiKey || !ai.apiEndpoint}
        style={{
          padding: '7px 0',
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background:
            testing || !ai.apiKey || !ai.apiEndpoint
              ? 'var(--border-default)'
              : 'var(--accent-default)',
          color: '#fff',
          cursor: testing || !ai.apiKey || !ai.apiEndpoint ? 'default' : 'pointer',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          fontFamily: 'var(--font-family)',
          opacity: testing || !ai.apiKey || !ai.apiEndpoint ? 0.5 : 1,
          transition: 'all 150ms ease-out',
        }}
      >
        {testing ? '测试中...' : '\uD83D\uDD0C 测试连接'}
      </button>

      {testResult && (
        <div
          style={{
            fontSize: 'var(--text-xs)',
            padding: '4px 0',
            color: testResult.success ? '#4ade80' : '#f87171',
          }}
        >
          {testResult.success
            ? '\u2705 连接成功'
            : `\u274C ${testResult.error || '连接失败'}`}
        </div>
      )}

      {/* Last tested timestamp */}
      {ai.lastTested && (
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
          }}
        >
          上次测试: {new Date(ai.lastTested).toLocaleString('zh-CN')}
        </div>
      )}

      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          marginTop: 8,
          lineHeight: 1.5,
        }}
      >
        {'\u26A0\uFE0F'} API Key 仅存储于本地浏览器，请妥善保管。
      </div>
    </div>
  )
}

// ─── Main SettingsModal ──────────────────────────────────────

/**
 * SettingsModal — glass-strong modal with 4-tab navigation.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 */
export default function SettingsModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState('canvas')

  if (!open) return null

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="glass-strong"
        style={{
          width: 540,
          height: 440,
          borderRadius: 'var(--radius-panel)',
          background: 'var(--surface-card)',
          boxShadow: 'var(--shadow-panel)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'condensationIn 400ms var(--liquid-ease-out)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontSize: 'var(--text-md)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            设置
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-xs)',
              border: '1px solid transparent',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'all 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body: tabs + content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left tab nav */}
          <div
            style={{
              width: 100,
              flexShrink: 0,
              borderRight: '1px solid var(--border-default)',
              padding: '8px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    margin: '0 4px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: isActive ? 'var(--accent-muted)' : 'transparent',
                    color: isActive ? 'var(--accent-default)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: isActive ? 500 : 400,
                    transition: 'all 150ms ease-out',
                    fontFamily: 'var(--font-family)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }
                  }}
                >
                  <Icon size={15} strokeWidth={1.5} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Right content area */}
          <div
            style={{
              flex: 1,
              padding: '16px 20px',
              overflowY: 'auto',
            }}
          >
            {activeTab === 'canvas' && <CanvasTab />}
            {activeTab === 'file' && <FileTab />}
            {activeTab === 'display' && <DisplayTab />}
            {activeTab === 'shortcuts' && <ShortcutsTab />}
            {activeTab === 'toolbar' && <ToolbarTab />}
            {activeTab === 'ai' && <AiTab />}
            {activeTab === 'about' && <AboutTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
