import { useState, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
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

export default function AiPanel() {
  // ── Store state ──────────────────────────────────────────
  const settings = useStore((s) => s.settings)
  const messages = useStore((s) => s.messages)
  const isAiPanelOpen = useStore((s) => s.isAiPanelOpen)
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
  const toggleAiPanel = useStore((s) => s.toggleAiPanel)
  const cards = useStore((s) => s.cards)
  const addCard = useStore((s) => s.addCard)
  const closeSettings = useStore((s) => s.closeSettings)

  // ── Local state ─────────────────────────────────────────
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef(null)
  const abortControllerRef = useRef(null)

  const ai = settings.ai
  const isConfigured = Boolean(ai.apiEndpoint && ai.apiKey && ai.modelName)
  const isTested = ai.lastTested !== null

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Resolve current spec context ─────────────────────────
  const getCurrentSpecContext = useCallback(() => {
    const specCards = cards.filter((c) => c.type === 'spec')
    const allCategories = getCategoryList()
    const specSections = specCards.map((c) => c.sectionTitle).filter(Boolean)

    for (const cat of allCategories) {
      const data = getSpecByCategory(cat.id)
      if (data) {
        const match = data.sections.some((s) => specSections.includes(s.title))
        if (match) return data
        if (specSections.some((s) => data.name.includes(s) || s.includes(data.name))) {
          return data
        }
      }
    }

    if (allCategories.length > 0) {
      return getSpecByCategory(allCategories[0].id)
    }

    return null
  }, [cards])

  // ── Send message handler ────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if (!text || isStreaming || !isConfigured || !isTested) return

    setInputText('')
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

    const config = {
      apiEndpoint: ai.apiEndpoint,
      apiKey: ai.apiKey,
      modelName: ai.modelName,
    }

    await sendStreamingChat(
      config,
      { messages: apiMessages, signal: abortController.signal },
      {
        onChunk: (chunk) => {
          const currentMessages = useStore.getState().messages
          const lastMsg = currentMessages[currentMessages.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            updateLastAssistantMessage(lastMsg.content + chunk)
          }
        },
        onDone: (fullText) => {
          setStreaming(false)
          abortControllerRef.current = null
        },
        onError: (err) => {
          const classified = classifyError(err)
          updateLastAssistantMessage(`❌ ${classified.message}`)
          setStreaming(false)
          abortControllerRef.current = null
        },
      },
    )
  }, [
    inputText,
    isStreaming,
    isConfigured,
    isTested,
    addMessage,
    setStreaming,
    updateLastAssistantMessage,
    getCurrentSpecContext,
    selectedTemplate,
    templates,
    currentMode,
    ai,
  ])

  // ── Cancel streaming ────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setStreaming(false)
  }, [setStreaming])

  // ── Handle enter key ────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // ── Template selection ──────────────────────────────────
  const handleTemplateChange = useCallback(
    (e) => {
      const id = e.target.value || null
      selectTemplate(id)
      if (id) {
        const tpl = templates.find((t) => t.id === id)
        if (tpl) {
          setMode(tpl.mode)
        }
      }
    },
    [selectTemplate, templates, setMode],
  )

  // ── Mode toggle ─────────────────────────────────────────
  const handleModeChange = useCallback(
    (mode) => {
      setMode(mode)
      if (selectedTemplate) {
        const tpl = templates.find((t) => t.id === selectedTemplate)
        if (tpl && tpl.mode !== mode) {
          selectTemplate(null)
        }
      }
    },
    [setMode, selectedTemplate, templates, selectTemplate],
  )

  // ── Styles ──────────────────────────────────────────────
  const styles = {
    container: {
      position: 'fixed',
      top: 60,
      right: 0,
      width: 400,
      height: `calc(100vh - 60px)`,
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-panel)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 80,
      borderRadius: '0 0 0 0',
      transform: 'translateX(0)',
      transition: 'transform 300ms var(--ease-out-smooth)',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: '1px solid var(--border-default)',
      flexShrink: 0,
      gap: 8,
    },
    modeRow: {
      display: 'flex',
      gap: 4,
      padding: '8px 16px',
      flexShrink: 0,
    },
    modeBtn: (active) => ({
      flex: 1,
      padding: '5px 0',
      borderRadius: 'var(--radius-xs)',
      border: '1px solid ' + (active ? 'var(--accent-default)' : 'var(--border-default)'),
      background: active ? 'var(--accent-muted)' : 'transparent',
      color: active ? 'var(--accent-default)' : 'var(--text-secondary)',
      cursor: 'pointer',
      fontSize: 'var(--text-xs)',
      fontWeight: active ? 500 : 400,
      fontFamily: 'var(--font-family)',
      transition: 'all 150ms ease-out',
    }),
    templateRow: {
      padding: '0 16px 8px',
      flexShrink: 0,
    },
    templateSelect: {
      width: '100%',
      padding: '5px 8px',
      borderRadius: 'var(--radius-xs)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-base)',
      color: 'var(--text-primary)',
      fontSize: 'var(--text-xs)',
      outline: 'none',
      fontFamily: 'var(--font-family)',
      cursor: 'pointer',
    },
    messagesArea: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minHeight: 0,
    },
    messageBubble: (role) => ({
      maxWidth: '85%',
      padding: '8px 12px',
      borderRadius: 'var(--radius-sm)',
      background:
        role === 'user' ? 'var(--surface-card-active)' : 'rgba(255,255,255,0.06)',
      color: 'var(--text-primary)',
      fontSize: 'var(--text-sm)',
      lineHeight: 1.5,
      alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      userSelect: 'text',
      cursor: 'text',
    }),
    inputRow: {
      display: 'flex',
      gap: 8,
      padding: '12px 16px',
      flexShrink: 0,
      borderTop: '1px solid var(--border-default)',
    },
    input: {
      flex: 1,
      padding: '8px 10px',
      borderRadius: 'var(--radius-xs)',
      border: '1px solid var(--border-default)',
      background: 'var(--surface-base)',
      color: 'var(--text-primary)',
      fontSize: 'var(--text-sm)',
      outline: 'none',
      fontFamily: 'var(--font-family)',
      resize: 'none',
    },
    sendBtn: (disabled) => ({
      padding: '8px 16px',
      borderRadius: 'var(--radius-xs)',
      border: 'none',
      background: disabled ? 'var(--border-default)' : 'var(--accent-default)',
      color: '#fff',
      cursor: disabled ? 'default' : 'pointer',
      fontSize: 'var(--text-sm)',
      fontWeight: 500,
      fontFamily: 'var(--font-family)',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 150ms ease-out',
    }),
    cancelBtn: {
      padding: '8px 16px',
      borderRadius: 'var(--radius-xs)',
      border: '1px solid var(--border-default)',
      background: 'transparent',
      color: 'var(--text-secondary)',
      cursor: 'pointer',
      fontSize: 'var(--text-sm)',
      fontFamily: 'var(--font-family)',
    },
    statusBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 16px',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)',
      flexShrink: 0,
      borderTop: '1px solid var(--border-default)',
    },
    placeholderMsg: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-tertiary)',
      padding: 20,
      textAlign: 'center',
    },
    clearBtn: {
      padding: '2px 8px',
      borderRadius: 'var(--radius-xs)',
      border: 'none',
      background: 'transparent',
      color: 'var(--text-tertiary)',
      cursor: 'pointer',
      fontSize: 'var(--text-xs)',
      fontFamily: 'var(--font-family)',
    },
  }

  // ── Determine status message ─────────────────────────────
  let statusMessage = ''
  if (!isConfigured) {
    statusMessage = '请先在设置中配置 AI 接口'
  } else if (!isTested) {
    statusMessage = '请先在设置中点击"测试连接"'
  } else {
    statusMessage = `当前模型: ${ai.modelName}`
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          🤖 AI 规范助手
        </span>
        <button
          onClick={() => { toggleAiPanel(); closeSettings() }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-xs)',
            border: 'none',
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

      {/* Mode toggle */}
      <div style={styles.modeRow}>
        <button
          style={styles.modeBtn(currentMode === 'quick')}
          onClick={() => handleModeChange('quick')}
        >
          快速问答
        </button>
        <button
          style={styles.modeBtn(currentMode === 'deep')}
          onClick={() => handleModeChange('deep')}
        >
          深度分析
        </button>
      </div>

      {/* Template selector */}
      <div style={styles.templateRow}>
        <select
          value={selectedTemplate || ''}
          onChange={handleTemplateChange}
          style={styles.templateSelect}
        >
          <option value="">自由提问（无模板）</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name} — {tpl.description}
            </option>
          ))}
        </select>
      </div>

      {/* Messages area */}
      <div style={styles.messagesArea}>
        {messages.length === 0 ? (
          <div style={styles.placeholderMsg}>
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
              const paragraphs = msg.content.split(/\n+/).filter(Boolean)
              return (
                <div key={msg.id} style={{ alignSelf: 'flex-start', maxWidth: '90%', width: '100%' }}>
                  {paragraphs.map((para, pi) => {
                    const items = parseSpecItems(para)
                    if (items.length > 0) {
                      return (
                        <div key={pi} style={{ marginBottom: 6 }}>
                          {items.map((item, si) => (
                            <div
                              key={si}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/json', JSON.stringify(item))
                                e.dataTransfer.effectAllowed = 'copy'
                              }}
                              onClick={() => addSpecCardFromAi(addCard, item)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid var(--border-default)',
                                marginBottom: 6,
                                cursor: 'grab',
                                userSelect: 'text',
                                transition: 'background 150ms ease-out',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                                  {item.label}
                                </div>
                                <span style={{ fontSize: '10px', color: 'var(--accent-default)', opacity: 0.8, flexShrink: 0 }}>
                                  [+] 点击添加
                                </span>
                              </div>
                              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--accent-default)', marginTop: 2 }}>
                                {item.value}
                              </div>
                              {item.note && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                  {item.note}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return (
                      <div
                        key={pi}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'var(--text-primary)',
                          fontSize: 'var(--text-sm)',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          userSelect: 'text',
                          cursor: 'text',
                          marginBottom: 4,
                        }}
                      >
                        {para}
                      </div>
                    )
                  })}
                  {msg === messages[messages.length - 1] && isStreaming && (
                    <span className="ai-cursor" />
                  )}
                </div>
              )
            }

            return (
              <div key={msg.id} style={styles.messageBubble(msg.role)}>
                {msg.content}
                {msg.role === 'assistant' &&
                 msg === messages[messages.length - 1] &&
                 isStreaming && (
                  <span className="ai-cursor" />
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <div style={styles.inputRow}>
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming
              ? 'AI 回复中...'
              : selectedTemplate
                ? templates.find((t) => t.id === selectedTemplate)?.name || '输入问题...'
                : '输入问题...'
          }
          disabled={isStreaming || !isConfigured || !isTested}
          style={styles.input}
        />
        {isStreaming ? (
          <button onClick={handleCancel} style={styles.cancelBtn}>
            停止
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={
              !inputText.trim() || isStreaming || !isConfigured || !isTested
            }
            style={styles.sendBtn(
              !inputText.trim() || isStreaming || !isConfigured || !isTested,
            )}
          >
            发送
          </button>
        )}
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>{statusMessage}</span>
        {messages.length > 0 && (
          <button onClick={clearMessages} style={styles.clearBtn}>
            清空对话
          </button>
        )}
      </div>
    </div>
  )
}
