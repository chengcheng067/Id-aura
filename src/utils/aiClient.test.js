/**
 * Unit tests for AI API Client.
 * Covers: testConnection, sendChat, sendStreamingChat, buildSpecContext, classifyError
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  testConnection,
  sendChat,
  sendStreamingChat,
  buildSpecContext,
  classifyError,
} from './aiClient'

// ==================== testConnection ====================
describe('testConnection', () => {
  const mockConfig = {
    apiEndpoint: 'https://api.openai.com/v1',
    apiKey: 'sk-test123',
    modelName: 'gpt-4o-mini',
  }

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('should send POST to /chat/completions with correct body', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ model: 'gpt-4o-mini' }),
    })

    await testConnection(mockConfig)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer sk-test123',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
      }),
    )
  })

  it('should return success=true on 200 response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ model: 'gpt-3.5-turbo' }),
    })

    const result = await testConnection(mockConfig)
    expect(result.success).toBe(true)
    expect(result.supportsVision).toBe(false)
  })

  it('should detect vision-capable models', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ model: 'gpt-4o' }),
    })

    const result = await testConnection(mockConfig)
    expect(result.success).toBe(true)
    expect(result.supportsVision).toBe(true)
  })

  it('should handle HTTP error responses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    })

    const result = await testConnection(mockConfig)
    expect(result.success).toBe(false)
    expect(result.error).toContain('HTTP 401')
  })

  it('should catch network errors', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'))

    const result = await testConnection(mockConfig)
    // classifyError returns { type, message } without success field
    expect(result.type).toBe('cors')
    expect(result.message).toContain('网络请求失败')
  })

  it('should accept an AbortSignal', async () => {
    const controller = new AbortController()
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ model: 'gpt-4o-mini' }),
    })

    await testConnection(mockConfig, controller.signal)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    )
  })
})

// ==================== sendChat ====================
describe('sendChat', () => {
  const mockConfig = {
    apiEndpoint: 'https://api.openai.com/v1',
    apiKey: 'sk-test123',
    modelName: 'gpt-4o-mini',
  }

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('should send messages and return content', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Hello!' } }],
        }),
    })

    const result = await sendChat(mockConfig, {
      messages: [{ role: 'user', content: 'hi' }],
    })

    expect(result.success).toBe(true)
    expect(result.content).toBe('Hello!')
  })

  it('should return error on HTTP failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limit exceeded'),
    })

    const result = await sendChat(mockConfig, {
      messages: [{ role: 'user', content: 'hi' }],
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('HTTP 429')
  })

  it('should handle AbortError gracefully', async () => {
    const abortError = new Error('The user aborted a request.')
    abortError.name = 'AbortError'
    global.fetch.mockRejectedValueOnce(abortError)

    const result = await sendChat(mockConfig, {
      messages: [{ role: 'user', content: 'hi' }],
      signal: new AbortController().signal,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('请求已取消')
  })
})

// ==================== sendStreamingChat ====================
describe('sendStreamingChat', () => {
  const mockConfig = {
    apiEndpoint: 'https://api.openai.com/v1',
    apiKey: 'sk-test123',
    modelName: 'gpt-4o-mini',
  }

  function createMockSSEResponse(chunks) {
    const encoder = new TextEncoder()
    const streams = chunks.map((c) => encoder.encode(c))

    return {
      ok: true,
      body: {
        getReader() {
          let i = 0
          return {
            read() {
              if (i < streams.length) {
                return Promise.resolve({ done: false, value: streams[i++] })
              }
              return Promise.resolve({ done: true, value: undefined })
            },
          }
        },
      },
    }
  }

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('should emit chunks and call onDone with full text', async () => {
    const sseData1 = 'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }) + '\n'
    const sseData2 = 'data: ' + JSON.stringify({ choices: [{ delta: { content: ' World' } }] }) + '\n'
    const sseData3 = 'data: [DONE]\n'

    global.fetch.mockResolvedValueOnce(createMockSSEResponse([sseData1, sseData2, sseData3]))

    const chunks = []
    const doneText = await new Promise((resolve) => {
      sendStreamingChat(
        mockConfig,
        { messages: [{ role: 'user', content: 'hi' }] },
        {
          onChunk: (chunk) => chunks.push(chunk),
          onDone: (text) => resolve(text),
          onError: () => resolve('ERROR'),
        },
      )
    })

    expect(chunks).toEqual(['Hello', ' World'])
    expect(doneText).toBe('Hello World')
  })

  it('should handle HTTP error via onError callback', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Model not found'),
    })

    const errorText = await new Promise((resolve) => {
      sendStreamingChat(
        mockConfig,
        { messages: [{ role: 'user', content: 'hi' }] },
        {
          onChunk: () => {},
          onDone: () => resolve('DONE'),
          onError: (err) => resolve(err.message),
        },
      )
    })

    // Error is classified — 404 maps to 'model' type with Chinese message
    expect(errorText).toBe('模型名称不存在或不可用')
  })

  it('should skip malformed SSE lines', async () => {
    const data =
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] }) + '\n' +
      'not json line\n' +
      'data: ' + JSON.stringify({ choices: [{ delta: { content: '!' } }] }) + '\n' +
      'data: [DONE]\n'

    global.fetch.mockResolvedValueOnce(createMockSSEResponse([data]))

    const doneText = await new Promise((resolve) => {
      sendStreamingChat(
        mockConfig,
        { messages: [{ role: 'user', content: 'hi' }] },
        {
          onChunk: () => {},
          onDone: (text) => resolve(text),
          onError: () => resolve('ERROR'),
        },
      )
    })

    expect(doneText).toBe('Hi!')
  })

  it('should send stream: true in the request body', async () => {
    global.fetch.mockResolvedValueOnce(createMockSSEResponse(['data: [DONE]\n']))

    await new Promise((resolve) => {
      sendStreamingChat(
        mockConfig,
        { messages: [{ role: 'user', content: 'hi' }] },
        {
          onChunk: () => {},
          onDone: () => resolve(),
          onError: () => resolve(),
        },
      )
    })

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.stream).toBe(true)
  })
})

// ==================== buildSpecContext ====================
describe('buildSpecContext', () => {
  const mockSpecData = {
    name: '餐饮规范',
    sections: [
      {
        title: '面积标准',
        items: [
          { label: '厨房面积', value: '≥30㎡', note: '不含库房', priority: 'high' },
          { label: '用餐区面积', value: '≥100㎡', priority: 'medium' },
        ],
      },
      {
        title: '排烟要求',
        items: [
          { label: '排烟量', value: '≥2000m³/h', note: '每灶头', priority: 'high' },
        ],
      },
    ],
  }

  it('should serialize spec data with name and sections', () => {
    const result = buildSpecContext(mockSpecData, 'quick')
    expect(result).toContain('餐饮规范')
    expect(result).toContain('面积标准')
    expect(result).toContain('厨房面积')
    expect(result).toContain('≥30㎡')
    expect(result).toContain('（不含库房）')
    expect(result).toContain('[high]')
    expect(result).toContain('排烟要求')
    expect(result).toContain('≥2000m³/h')
  })

  it('should use deep mode prompt when mode=deep', () => {
    const result = buildSpecContext(mockSpecData, 'deep')
    expect(result).toContain('资深设计规范顾问')
    expect(result).toContain('深度分析')
  })

  it('should use quick mode prompt when mode=quick', () => {
    const result = buildSpecContext(mockSpecData, 'quick')
    expect(result).toContain('设计规范助手')
    expect(result).not.toContain('资深')
  })

  it('should use template system prompt when provided', () => {
    const templatePrompt = '请生成一份合规检查清单'
    const result = buildSpecContext(mockSpecData, 'quick', templatePrompt)
    expect(result).toContain('合规检查清单')
    expect(result).not.toContain('设计规范助手')
  })

  it('should handle empty specData gracefully', () => {
    const result = buildSpecContext(null, 'quick')
    expect(result).toContain('暂无可用规范数据')
  })

  it('should handle specData with empty sections', () => {
    const result = buildSpecContext({ name: '测试', sections: [] }, 'quick')
    expect(result).toContain('暂无可用规范数据')
  })
})

// ==================== classifyError ====================
describe('classifyError', () => {
  it('should classify 401 as auth error', () => {
    const result = classifyError(new Error('HTTP 401: Unauthorized'))
    expect(result.type).toBe('auth')
  })

  it('should classify 404 as model error', () => {
    const result = classifyError(new Error('HTTP 404: Model not found'))
    expect(result.type).toBe('model')
  })

  it('should classify 429 as rate-limit error', () => {
    const result = classifyError(new Error('HTTP 429: Too many requests'))
    expect(result.type).toBe('rate-limit')
  })

  it('should classify timeout errors', () => {
    const result = classifyError(new Error('The operation timed out'))
    expect(result.type).toBe('timeout')
  })

  it('should classify AbortError as timeout', () => {
    const err = new Error('The user aborted a request.')
    err.name = 'AbortError'
    const result = classifyError(err)
    expect(result.type).toBe('timeout')
  })

  it('should classify network errors as cors', () => {
    const result = classifyError(new Error('Failed to fetch'))
    expect(result.type).toBe('cors')

    const result2 = classifyError(new Error('NetworkError'))
    expect(result2.type).toBe('cors')

    const result3 = classifyError(new Error('load failed'))
    expect(result3.type).toBe('cors')
  })

  it('should classify unknown errors', () => {
    const result = classifyError(new Error('Something went wrong'))
    expect(result.type).toBe('unknown')
  })

  it('should handle non-Error objects', () => {
    const result = classifyError({ message: '429 rate limit' })
    expect(result.type).toBe('rate-limit')
  })

  it('should handle empty/null error gracefully', () => {
    const result = classifyError({})
    expect(result.type).toBe('unknown')
  })
})
