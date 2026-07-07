/**
 * Unit tests for chat slice.
 * Covers: addMessage, updateLastAssistantMessage, clearMessages,
 *          toggleAiPanel, selectTemplate, setMode, setStreaming, getContextMessages
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createChatSlice } from './chatSlice'

// Mock nanoid to return deterministic IDs
vi.mock('nanoid', () => ({
  nanoid: () => 'test-id-' + Math.random().toString(36).slice(2, 8),
}))

function createMockStore() {
  let state = { messages: [], isAiPanelOpen: false, isStreaming: false, selectedTemplate: null, currentMode: 'quick' }
  const set = (updater) => {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) }
    } else {
      state = { ...state, ...updater }
    }
  }
  const get = () => state
  const slice = createChatSlice(set, get)
  state = { ...state, ...slice }
  return { set, get, state, slice }
}

// ==================== Initial State ====================
describe('chatSlice — initialState', () => {
  it('should initialize with empty messages', () => {
    const store = createMockStore()
    expect(store.get().messages).toEqual([])
  })

  it('should initialize with isAiPanelOpen = false', () => {
    const store = createMockStore()
    expect(store.get().isAiPanelOpen).toBe(false)
  })

  it('should initialize with isStreaming = false', () => {
    const store = createMockStore()
    expect(store.get().isStreaming).toBe(false)
  })

  it('should initialize with currentMode = quick', () => {
    const store = createMockStore()
    expect(store.get().currentMode).toBe('quick')
  })

  it('should initialize with 5 templates', () => {
    const store = createMockStore()
    expect(store.get().templates).toHaveLength(5)
  })

  it('should have all five expected templates', () => {
    const store = createMockStore()
    const ids = store.get().templates.map((t) => t.id)
    expect(ids).toEqual(['checklist', 'dimension', 'layout', 'conflict', 'explain'])
  })
})

// ==================== addMessage ====================
describe('chatSlice — addMessage', () => {
  it('should add a user message', () => {
    const store = createMockStore()
    store.slice.addMessage('user', 'Hello AI')
    const msgs = store.get().messages
    expect(msgs).toHaveLength(1)
    expect(msgs[0].role).toBe('user')
    expect(msgs[0].content).toBe('Hello AI')
    expect(msgs[0].id).toBeTruthy()
    expect(msgs[0].timestamp).toBeTruthy()
  })

  it('should add an assistant message', () => {
    const store = createMockStore()
    store.slice.addMessage('assistant', 'Hello human')
    const msgs = store.get().messages
    expect(msgs[0].role).toBe('assistant')
    expect(msgs[0].content).toBe('Hello human')
  })

  it('should keep last MAX_MESSAGES when limit is exceeded', () => {
    const store = createMockStore()
    // Add 21 messages (MAX_MESSAGES = 20)
    for (let i = 0; i < 21; i++) {
      store.slice.addMessage('user', `Message ${i}`)
    }
    const msgs = store.get().messages
    expect(msgs).toHaveLength(20)
    // Should have messages 1-20 (dropping message 0)
    expect(msgs[0].content).toBe('Message 1')
    expect(msgs[19].content).toBe('Message 20')
  })

  it('should keep messages under the limit untouched', () => {
    const store = createMockStore()
    for (let i = 0; i < 15; i++) {
      store.slice.addMessage('user', `Msg ${i}`)
    }
    expect(store.get().messages).toHaveLength(15)
  })
})

// ==================== updateLastAssistantMessage ====================
describe('chatSlice — updateLastAssistantMessage', () => {
  it('should update the last assistant message content', () => {
    const store = createMockStore()
    store.slice.addMessage('user', 'Hello')
    store.slice.addMessage('assistant', '')
    store.slice.addMessage('user', 'Follow up')
    store.slice.updateLastAssistantMessage('Hello! How can I help?')
    const msgs = store.get().messages
    const assistantMsg = msgs.find((m) => m.role === 'assistant')
    expect(assistantMsg.content).toBe('Hello! How can I help?')
  })

  it('should not modify user messages', () => {
    const store = createMockStore()
    store.slice.addMessage('user', 'Hello')
    store.slice.updateLastAssistantMessage('Updated')
    const userMsg = store.get().messages[0]
    expect(userMsg.content).toBe('Hello')
  })

  it('should do nothing if no assistant message exists', () => {
    const store = createMockStore()
    store.slice.addMessage('user', 'Hello')
    expect(() => store.slice.updateLastAssistantMessage('Updated')).not.toThrow()
    expect(store.get().messages).toHaveLength(1)
  })
})

// ==================== clearMessages ====================
describe('chatSlice — clearMessages', () => {
  it('should remove all messages', () => {
    const store = createMockStore()
    store.slice.addMessage('user', 'A')
    store.slice.addMessage('assistant', 'B')
    store.slice.addMessage('user', 'C')
    store.slice.clearMessages()
    expect(store.get().messages).toHaveLength(0)
  })

  it('should work on empty messages', () => {
    const store = createMockStore()
    expect(() => store.slice.clearMessages()).not.toThrow()
    expect(store.get().messages).toHaveLength(0)
  })
})

// ==================== toggleAiPanel ====================
describe('chatSlice — toggleAiPanel', () => {
  it('should toggle from false to true', () => {
    const store = createMockStore()
    expect(store.get().isAiPanelOpen).toBe(false)
    store.slice.toggleAiPanel()
    expect(store.get().isAiPanelOpen).toBe(true)
  })

  it('should toggle from true to false', () => {
    const store = createMockStore()
    store.slice.toggleAiPanel()
    store.slice.toggleAiPanel()
    expect(store.get().isAiPanelOpen).toBe(false)
  })
})

// ==================== setStreaming ====================
describe('chatSlice — setStreaming', () => {
  it('should set streaming to true', () => {
    const store = createMockStore()
    store.slice.setStreaming(true)
    expect(store.get().isStreaming).toBe(true)
  })

  it('should set streaming to false', () => {
    const store = createMockStore()
    store.slice.setStreaming(true)
    store.slice.setStreaming(false)
    expect(store.get().isStreaming).toBe(false)
  })
})

// ==================== selectTemplate ====================
describe('chatSlice — selectTemplate', () => {
  it('should select a template by id', () => {
    const store = createMockStore()
    store.slice.selectTemplate('layout')
    expect(store.get().selectedTemplate).toBe('layout')
  })

  it('should deselect with null', () => {
    const store = createMockStore()
    store.slice.selectTemplate('checklist')
    store.slice.selectTemplate(null)
    expect(store.get().selectedTemplate).toBeNull()
  })
})

// ==================== setMode ====================
describe('chatSlice — setMode', () => {
  it('should set mode to quick', () => {
    const store = createMockStore()
    store.slice.setMode('quick')
    expect(store.get().currentMode).toBe('quick')
  })

  it('should set mode to deep', () => {
    const store = createMockStore()
    store.slice.setMode('deep')
    expect(store.get().currentMode).toBe('deep')
  })
})

// ==================== getContextMessages ====================
describe('chatSlice — getContextMessages', () => {
  it('should return all non-system messages', () => {
    const store = createMockStore()
    store.slice.addMessage('system', 'System prompt')
    store.slice.addMessage('user', 'Hello')
    store.slice.addMessage('assistant', 'Hi')
    const ctx = store.slice.getContextMessages()
    expect(ctx).toHaveLength(2)
    expect(ctx[0].role).toBe('user')
    expect(ctx[1].role).toBe('assistant')
  })

  it('should return at most MAX_MESSAGES entries', () => {
    const store = createMockStore()
    // Add 25 messages
    for (let i = 0; i < 25; i++) {
      store.slice.addMessage('user', `Msg ${i}`)
    }
    const ctx = store.slice.getContextMessages()
    expect(ctx).toHaveLength(20)
  })
})
