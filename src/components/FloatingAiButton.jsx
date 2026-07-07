import { useState, useEffect, useRef, useCallback } from 'react'
import { Bot, X, Paperclip, Link, Code, Send, Info } from 'lucide-react'
import useStore from '../store/useStore'
import { getSpecByCategory, getCategoryList } from '../data/specs'
import {
  sendStreamingChat,
  buildSpecContext,
  classifyError,
} from '../utils/aiClient'
import {
  parseSpecItems,
  mapPriority,
  addSpecCardFromAi,
} from '../utils/parseSpecItems'

const MAX_CHARS = 2000

/** Infer provider label from API endpoint URL. */
function inferProvider(endpoint) {
  if (!endpoint) return '自定义'
  const lower = endpoint.toLowerCase()
  if (lower.includes('openai.com') || lower.includes('api.openai')) return 'OpenAI'
  if (lower.includes('anthropic.com') || lower.includes('api.anthropic')) return 'Anthropic'
  if (lower.includes('google') || lower.includes('gemini')) return 'Google'
  if (lower.includes('azure') || lower.includes('openai.azure')) return 'Azure'
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return '本地'
  if (lower.includes('deepseek')) return 'DeepSeek'
  if (lower.includes('siliconflow') || lower.includes('silicon')) return 'SiliconFlow'
  if (lower.includes('moonshot') || lower.includes('kimi')) return 'Moonshot'
  if (lower.includes('openrouter')) return 'OpenRouter'
  return '自定义'
}

/**
 * FloatingAiAssistant — 发光AI气泡 + 浮动磨砂玻璃聊天窗口
 *
 * 点击气泡后：
 *   1. 气泡旋转90°，图标从Bot变为X
 *   2. 弹出磨砂玻璃质感悬浮聊天窗口（悬浮于画板上方）
 *   3. 再次点击或点击X/外部区域关闭
 */
export default function FloatingAiAssistant() {
  const toggleAiPanel = useStore((s) => s.toggleAiPanel)
  const isAiPanelOpen = useStore((s) => s.isAiPanelOpen)

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [charCount, setCharCount] = useState(0)

  // ── AI backend state ──────────────────────────────
  const settings = useStore((s) => s.settings)
  const messages = useStore((s) => s.messages)
  const isStreaming = useStore((s) => s.isStreaming)
  const selectedTemplate = useStore((s) => s.selectedTemplate)
  const currentMode = useStore((s) => s.currentMode)
  const templates = useStore((s) => s.templates)
  const addMessage = useStore((s) => s.addMessage)
  const setStreaming = useStore((s) => s.setStreaming)
  const updateLastAssistantMessage = useStore((s) => s.updateLastAssistantMessage)
  const clearMessages = useStore((s) => s.clearMessages)
  const selectTemplate = useStore((s) => s.selectTemplate)
  const setMode = useStore((s) => s.setMode)
  const cards = useStore((s) => s.cards)
  const addCard = useStore((s) => s.addCard)

  const chatRef = useRef(null)
  const messagesEndRef = useRef(null)
  const abortControllerRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  const ai = settings.ai
  const isConfigured = Boolean(ai.apiEndpoint && ai.apiKey && ai.modelName)
  const isTested = ai.lastTested !== null

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close on outside click
  useEffect(() => {
    if (!isChatOpen) return
    const handleClickOutside = (e) => {
      if (chatRef.current && !chatRef.current.contains(e.target)) {
        if (!e.target.closest('.glow-ai-btn')) {
          setIsChatOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isChatOpen])

  // ── Spec context for AI ───────────────────────────
  const getCurrentSpecContext = useCallback(() => {
    const specCards = cards.filter((c) => c.type === 'spec')
    const allCategories = getCategoryList()
    const specSections = specCards.map((c) => c.sectionTitle).filter(Boolean)
    for (const cat of allCategories) {
      const data = getSpecByCategory(cat.id)
      if (data) {
        const match = data.sections.some((s) => specSections.includes(s.title))
        if (match) return data
        if (specSections.some((s) => data.name.includes(s) || s.includes(data.name))) return data
      }
    }
    if (allCategories.length > 0) return getSpecByCategory(allCategories[0].id)
    return null
  }, [cards])

  // ── Send message ───────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = message.trim()
    if (!text || isStreaming || !isConfigured || !isTested) return

    setMessage('')
    setCharCount(0)
    addMessage('user', text)

    const specData = getCurrentSpecContext()
    const activeTemplate = templates.find((t) => t.id === selectedTemplate)
    const systemContent = buildSpecContext(
      specData,
      currentMode,
      activeTemplate?.systemPrompt || null,
    )

    const contextMessages = useStore.getState().getContextMessages()
    const apiMessages = [
      { role: 'system', content: systemContent },
      ...contextMessages,
      { role: 'user', content: text },
    ]

    addMessage('assistant', '')
    setStreaming(true)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    await sendStreamingChat(
      { apiEndpoint: ai.apiEndpoint, apiKey: ai.apiKey, modelName: ai.modelName },
      { messages: apiMessages, signal: abortController.signal },
      {
        onChunk: (chunk) => {
          const currentMessages = useStore.getState().messages
          const lastMsg = currentMessages[currentMessages.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            updateLastAssistantMessage(lastMsg.content + chunk)
          }
        },
        onDone: () => { setStreaming(false); abortControllerRef.current = null },
        onError: (err) => {
          const classified = classifyError(err)
          updateLastAssistantMessage(`❌ ${classified.message}`)
          setStreaming(false)
          abortControllerRef.current = null
        },
      },
    )
  }, [message, isStreaming, isConfigured, isTested, addMessage, setStreaming, updateLastAssistantMessage, getCurrentSpecContext, selectedTemplate, templates, currentMode, ai])

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    setStreaming(false)
  }

  // ── Input handlers ─────────────────────────────────
  const handleInputChange = (e) => {
    const v = e.target.value
    setMessage(v)
    setCharCount(v.length)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /** Insert text into the textarea at the current cursor position. */
  const insertTextAtCursor = (text) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? message.length
    const end = el.selectionEnd ?? message.length
    const newValue = message.slice(0, start) + text + message.slice(end)
    setMessage(newValue)
    setCharCount(newValue.length)
    // Restore focus and place cursor after the inserted text
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + text.length
      el.setSelectionRange(pos, pos)
    })
  }

  /** Handle image file selected from the attachment button. */
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      addCard('image', { imageUrl: url, name: file.name, sourceType: 'local' })
      insertTextAtCursor(`[参考图：${file.name}] `)
    }
    e.target.value = ''
  }

  const handleToggle = () => {
    setIsChatOpen(!isChatOpen)
  }

  // ── Status message ─────────────────────────────────
  let statusLabel = ''
  if (!isConfigured) statusLabel = '未配置'
  else if (!isTested) statusLabel = '未测试'
  else statusLabel = ai.modelName || ''

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100 }}>
      {/* ═══ Glowing AI Button ═══ */}
      <button
        className="glow-ai-btn"
        onClick={handleToggle}
        title="AI 规范助手"
        style={{
          position: 'relative',
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.2)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.85), rgba(168,85,247,0.85))',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow:
            '0 0 20px rgba(139,92,246,0.7),' +
            '0 0 40px rgba(124,58,237,0.5),' +
            '0 0 60px rgba(109,40,217,0.3)',
          transition: 'transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 300ms ease-out',
          outline: 'none',
          padding: 0,
          transform: isChatOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = isChatOpen ? 'rotate(90deg) scale(1.12)' : 'scale(1.12) rotate(5deg)'
          e.currentTarget.style.boxShadow =
            '0 0 30px rgba(139,92,246,0.9),' +
            '0 0 50px rgba(124,58,237,0.7),' +
            '0 0 70px rgba(109,40,217,0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = isChatOpen ? 'rotate(90deg)' : 'rotate(0deg)'
          e.currentTarget.style.boxShadow =
            '0 0 20px rgba(139,92,246,0.7),' +
            '0 0 40px rgba(124,58,237,0.5),' +
            '0 0 60px rgba(109,40,217,0.3)'
        }}
      >
        {/* 3D highlight */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)', opacity: 0.35, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.12)', pointerEvents: 'none',
        }} />

        {/* Icon: Bot when closed, X when open */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {isChatOpen ? <X size={26} strokeWidth={1.75} /> : <Bot size={26} strokeWidth={1.75} />}
        </div>

        {/* Pulse ring */}
        {!isChatOpen && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(99,102,241,0.4)',
            animation: 'aiPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            pointerEvents: 'none',
          }} />
        )}
      </button>

      {/* ═══ Floating Chat Window ═══ */}
      {isChatOpen && (
        <div
          ref={chatRef}
          className="ai-chat-popup"
          style={{
            position: 'absolute',
            bottom: 72,  /* above button */
            right: 0,
            width: Math.min(480, window.innerWidth - 80),
            animation: 'chatPopIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            transformOrigin: 'bottom right',
          }}
        >
          {/* Frosted glass container */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(39,39,42,0.85), rgba(24,24,27,0.92))',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow:
              '0 8px 32px rgba(0,0,0,0.5),' +
              '0 0 0 1px rgba(255,255,255,0.04) inset,' +
              '0 -20px 40px rgba(99,102,241,0.06), ' +
              '0 20px 40px rgba(147,51,234,0.05)',
            backdropFilter: 'blur(28px) saturate(150%)',
            WebkitBackdropFilter: 'blur(28px) saturate(150%)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px 8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 6px rgba(34,197,94,0.6)',
                  animation: 'statusPulse 2s ease-in-out infinite',
                }}/>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                  AI Assistant
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span title={!isConfigured ? '未配置' : !isTested ? '待测试' : ai.modelName} style={{
                  padding: '2px 10px', fontSize: 11, fontWeight: 600,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, color: 'rgba(255,255,255,0.7)',
                  maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {!isConfigured ? '未配置' : !isTested ? '待测试' : (ai.modelName || '默认模型')}
                </span>
                {isConfigured && isTested && (
                  <span style={{
                    padding: '2px 10px', fontSize: 11, fontWeight: 600,
                    background: 'rgba(139,92,246,0.12)',
                    border: '1px solid rgba(139,92,246,0.18)',
                    borderRadius: 12, color: '#a78bfa',
                  }}>
                    {inferProvider(ai.apiEndpoint)}
                  </span>
                )}
                <button onClick={() => setIsChatOpen(false)} style={{
                  width: 26, height: 26, borderRadius: 8, border: 'none',
                  background: 'transparent', color: 'rgba(255,255,255,0.45)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  transition: 'all 150ms ease-out',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.color='#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.45)' }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Messages area (compact) */}
            <div style={{
              flex: 1, minHeight: 120, maxHeight: 260, overflowY: 'auto',
              padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6,
              scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent',
            }}>
              {messages.length === 0 ? (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0',
                  lineHeight: 1.6,
                }}>
                  {!isConfigured
                    ? '请先在设置中配置 AI 接口'
                    : !isTested
                      ? '请先在设置中点击"测试连接"'
                      : '输入问题开始对话，或选择一个模板快速开始'}
                </div>
              ) : (
                messages.map((msg) => {
                  const specItems = msg.role === 'assistant' ? parseSpecItems(msg.content) : []
                  if (specItems.length > 0) {
                    return (
                      <div key={msg.id} style={{ alignSelf: 'flex-start', maxWidth: '95%', width: '100%' }}>
                        {specItems.map((item, si) => (
                          <div key={si} draggable onDragStart={(e) => {
                            e.dataTransfer.setData('application/json', JSON.stringify(item))
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                            onClick={() => addSpecCardFromAi(addCard, item)}
                            style={{
                              padding: '8px 10px', borderRadius: 10,
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.08)', marginBottom: 4, cursor: 'grab',
                              transition: 'background 150ms ease-out',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.10)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#e5e7eb' }}>{item.label}</span>
                              <span style={{ fontSize: 10, color: '#818cf8', opacity: 0.85 }}>[+]</span>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', marginTop: 2 }}>{item.value}</div>
                            {item.note && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{item.note}</div>}
                          </div>
                        ))}
                      </div>
                    )
                  }
                  return (
                    <div key={msg.id} style={{
                      maxWidth: '85%', padding: '8px 12px', borderRadius: 12,
                      background: msg.role === 'user' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                      color: '#e5e7eb', fontSize: 13, lineHeight: 1.55,
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {msg.content}
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Textarea input area */}
            <div style={{ position: 'relative', padding: '8px 14px 0' }}>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={3}
                disabled={isStreaming || !isConfigured || !isTested}
                placeholder={
                  isStreaming ? 'AI 回复中...' :
                    selectedTemplate ? `模板: ${templates.find(t=>t.id===selectedTemplate)?.name}` :
                      'What would you like to explore today? Ask anything...'
                }
                style={{
                  width: '100%', minHeight: 76, maxHeight: 120,
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e5e7eb', fontSize: 13.5, lineHeight: 1.55,
                  outline: 'none', resize: 'none',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  transition: 'border-color 200ms ease-out',
                  scrollbarWidth: 'none',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
              {/* Gradient overlay at bottom of textarea */}
              <div style={{
                position: 'absolute', bottom: 0, left: 14, right: 14, height: 20,
                background: 'linear-gradient(to top, rgba(39,39,42,0.9), transparent)',
                pointerEvents: 'none', borderRadius: '0 0 14px 14px',
              }}/>
            </div>

            {/* Controls row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px 10px', gap: 8,
            }}>
              {/* Left: attachment group */}
              <div style={{
                display: 'flex', gap: 2, padding: '3px',
                borderRadius: 10, background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <AttachBtn icon={<Paperclip size={15} />} label="上传图片参考" hoverColor="#f97316" rotate="-rotate-3" onClick={() => fileInputRef.current?.click()} />
                <AttachBtn icon={<Link size={15} />} label="插入链接" hoverColor="#ef4444" rotate="rotate-6" onClick={() => insertTextAtCursor('[链接：]')} />
                <AttachBtn icon={<Code size={15} />} label="插入代码块" hoverColor="#22c55e" rotate="rotate-3" onClick={() => insertTextAtCursor('\n```\n\n```\n')} />
                <AttachBtn
                  icon={<svg viewBox="0 0 24 24" fill="currentColor" width={15} height={15}><path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.354-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.015-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117v-6.038H8.148zm7.704 0c-2.476 0-4.49 2.015-4.49 4.49s2.014 4.49 4.49 4.49 4.49-2.015 4.49-4.49-2.014-4.49-4.49-4.49zm0 7.509c-1.665 0-3.019-1.355-3.019-3.019s1.355-3.019 3.019-3.019 3.019 1.354 3.019 3.019-1.354 3.019-3.019 3.019z"/></svg>}
                  label="Figma 分析" hoverColor="#a855f7" rotate="-rotate-6"
                  onClick={() => insertTextAtCursor('请分析这个 Figma 设计稿：[Figma：]')}
                />
              </div>

              {/* Right side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Char counter */}
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  <span style={{ color: charCount > MAX_CHARS * 0.9 ? '#f87171' : 'rgba(255,255,255,0.5)' }}>{charCount}</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>/{MAX_CHARS}</span>
                </span>

                {/* Send button */}
                {isStreaming ? (
                  <button onClick={handleCancel} style={{
                    width: 38, height: 38, borderRadius: 11, border: '1px solid var(--border-default)',
                    background: 'transparent', color: 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  }}>停止</button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || !isConfigured || !isTested}
                    title="发送"
                    style={{
                      width: 38, height: 38, borderRadius: 11, border: 'none',
                      background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                      color: '#fff', cursor: (!message.trim() || !isConfigured || !isTested) ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      boxShadow: message.trim() ? '0 4px 14px rgba(220,38,38,0.35)' : 'none',
                      opacity: (!message.trim() || !isConfigured || !isTested) ? 0.4 : 1,
                      transition: 'all 200ms ease-out',
                    }}
                    onMouseEnter={(e) => { if (message.trim()) { e.currentTarget.style.transform = 'scale(1.08) translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(220,38,38,0.45)' } }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = message.trim() ? '0 4px 14px rgba(220,38,38,0.35)' : 'none' }}
                  >
                    <Send size={17} strokeWidth={2} style={{ transform: 'translateX(1px) translateY(1px) rotate(-5deg)' }} />
                  </button>
                )}
              </div>
            </div>

            {/* Footer info bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 16px 10px', borderTop: '1px solid rgba(255,255,255,0.05)',
              fontSize: 11, color: 'rgba(255,255,255,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Info size={12} strokeWidth={1.75} />
                <span>Press <kbd style={{
                  padding: '1px 4px', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
                  fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace',
                }}>Shift</kbd> + <kbd style={{
                  padding: '1px 4px', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
                  fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace',
                }}>Enter</kbd> for new line</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                <span>{!isConfigured ? '未配置' : !isTested ? '待测试' : '运行正常'}</span>
              </div>
            </div>

            {/* Subtle overlay gradient */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 20, pointerEvents: 'none',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.03), transparent, rgba(147,51,234,0.03))',
            }} />
          </div>
        </div>
      )}

      {/* Hidden file input for attachment button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes aiPulse {
          0% { transform: scale(1); opacity: 0.4; }
          70% { transform: scale(1.65); opacity: 0; }
          100% { transform: scale(1.65); opacity: 0; }
        }
        @keyframes chatPopIn {
          0% { opacity: 0; transform: scale(0.88) translateY(16px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

/** Small attachment toolbar button */
function AttachBtn({ icon, label, hoverColor, rotate, onClick }) {
  return (
    <button title={label} onClick={onClick} className="attach-btn" style={{
      width: 30, height: 30, borderRadius: 7, border: 'none',
      background: 'transparent', color: 'rgba(255,255,255,0.35)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      transition: 'all 250ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      position: 'relative',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = hoverColor
        e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
        e.currentTarget.style.transform = `scale(1.1) ${rotate}`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.transform = 'scale(1) rotate(0)'
      }}
    >
      {icon}
    </button>
  )
}
