/**
 * Chat slice — manages AI conversation state.
 *
 * State:
 *   - messages: array of { id, role, content, timestamp }
 *   - isAiPanelOpen: toggle for the AI chat panel
 *   - isStreaming: whether a streaming response is in progress
 *   - selectedTemplate: currently selected template ID (null = free input)
 *   - currentMode: 'quick' | 'deep'
 *   - templates: list of preset prompt templates
 */

import { nanoid } from 'nanoid'

const MAX_MESSAGES = 20
const MAX_TOKENS_ESTIMATE = 8000

const DEFAULT_TEMPLATES = [
  {
    id: 'checklist',
    name: '规范检查清单',
    description: '生成当前品类的合规检查清单',
    systemPrompt:
      '请根据以下规范数据生成一份完整的合规检查清单，按优先级（高/中/低）分类，每条给出检查要点和验收标准。',
    mode: 'quick',
  },
  {
    id: 'dimension',
    name: '尺寸查询',
    description: '查询具体尺寸/面积要求',
    systemPrompt:
      '请根据以下规范数据回答用户的尺寸查询问题。给出具体数值、依据和常见做法。',
    mode: 'quick',
  },
  {
    id: 'layout',
    name: '布局建议',
    description: '根据规范给出空间布局优化建议',
    systemPrompt:
      '请根据以下规范数据分析该品类的空间布局要求，包括动线、分区、配比等，给出优化建议和常见设计误区。',
    mode: 'deep',
  },
  {
    id: 'conflict',
    name: '冲突排查',
    description: '不同规范之间的兼容性分析',
    systemPrompt:
      '以下是一个复合业态或多个品类的规范数据。请对比分析各规范之间的差异和潜在冲突点（如排烟、防火、通道等），给出兼容方案。',
    mode: 'deep',
  },
  {
    id: 'explain',
    name: '规范解释',
    description: '用口语化方式解释规范背景',
    systemPrompt:
      '请用通俗易懂的语言解释用户指定的规范条目。说明为什么有这个要求、常见的设计误区和正确的做法。',
    mode: 'quick',
  },
]

/**
 * Create chat slice for Zustand store.
 * @param {Function} set
 * @param {Function} get
 * @returns {object} chat state and actions
 */
export const createChatSlice = (set, get) => ({
  messages: [],
  isAiPanelOpen: false,
  isStreaming: false,
  selectedTemplate: null,
  currentMode: 'quick',
  templates: DEFAULT_TEMPLATES,
  aiPanelWidth: 400,

  /**
   * Toggle AI panel open/closed.
   */
  toggleAiPanel: () => set((s) => ({ isAiPanelOpen: !s.isAiPanelOpen })),

  /**
   * Set AI panel width (clamped to 320-600).
   * @param {number} width
   */
  setAiPanelWidth: (width) => set({ aiPanelWidth: Math.min(Math.max(width, 320), 600) }),

  /**
   * Add a message to the conversation.
   * Automatically trims to MAX_MESSAGES from the tail.
   * @param {'user'|'assistant'|'system'} role
   * @param {string} content
   */
  addMessage: (role, content) =>
    set((s) => {
      const newMsg = { id: nanoid(), role, content, timestamp: Date.now() }
      const messages = [...s.messages, newMsg]
      if (messages.length > MAX_MESSAGES) {
        return { messages: messages.slice(messages.length - MAX_MESSAGES) }
      }
      return { messages }
    }),

  /**
   * Set streaming state.
   * @param {boolean} v
   */
  setStreaming: (v) => set({ isStreaming: v }),

  /**
   * Update the content of the last assistant message (used during streaming).
   * @param {string} content
   */
  updateLastAssistantMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content }
          break
        }
      }
      return { messages: msgs }
    }),

  /**
   * Clear all messages.
   */
  clearMessages: () => set({ messages: [] }),

  /**
   * Select a template by ID (null to deselect).
   * @param {string|null} templateId
   */
  selectTemplate: (templateId) => set({ selectedTemplate: templateId }),

  /**
   * Set the conversation mode.
   * @param {'quick'|'deep'} mode
   */
  setMode: (mode) => set({ currentMode: mode }),

  /**
   * Get messages suitable for API context.
   * Filters out system messages and returns the tail up to MAX_MESSAGES.
   * @returns {Array<{role:string,content:string}>}
   */
  getContextMessages: () => {
    const { messages } = get()
    return messages.filter((m) => m.role !== 'system').slice(-MAX_MESSAGES)
  },
})
