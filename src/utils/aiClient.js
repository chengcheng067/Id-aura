/**
 * AI API Client — OpenAI-compatible chat completions.
 *
 * Provides:
 *   - testConnection: verify API config with a minimal request
 *   - sendStreamingChat: SSE-based streaming via ReadableStream
 *   - sendChat: non-streaming completion for quick/deep modes
 *   - buildSpecContext: assemble system message with spec data
 *   - classifyError: categorise HTTP/network errors for UI feedback
 */

const VISION_MODEL_PATTERNS = /vision|gpt-4o|claude-3|gemini-pro-vision|qwen-vl/i

/**
 * @typedef {Object} AiClientConfig
 * @property {string} apiEndpoint
 * @property {string} apiKey
 * @property {string} modelName
 */

/**
 * @typedef {Object} AiRequest
 * @property {Array<{role:string,content:string}>} messages
 * @property {AbortSignal} [signal]
 */

/**
 * Test connection to AI API.
 * Sends a minimal request ("hi" with max_tokens=5) to verify config works.
 * @param {AiClientConfig} config
 * @param {AbortSignal} [signal]
 * @returns {Promise<{success: boolean, error?: string, supportsVision?: boolean}>}
 */
export async function testConnection(config, signal) {
  try {
    const body = {
      model: config.modelName,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5,
    }

    const resp = await fetch(`${config.apiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '')
      return {
        success: false,
        error: `HTTP ${resp.status}${errorText ? `: ${errorText.slice(0, 200)}` : ''}`,
      }
    }

    const data = await resp.json()
    const model = data.model || config.modelName
    const supportsVision = VISION_MODEL_PATTERNS.test(model)

    return { success: true, supportsVision }
  } catch (err) {
    return { success: false, ...classifyError(err) }
  }
}

/**
 * Send a streaming chat completion request to AI API (OpenAI-compatible).
 * @param {AiClientConfig} config
 * @param {AiRequest} request - { messages, signal }
 * @param {object} callbacks - { onChunk, onDone, onError }
 * @param {(text: string) => void} callbacks.onChunk
 * @param {(fullText: string) => void} callbacks.onDone
 * @param {(err: Error) => void} callbacks.onError
 */
export async function sendStreamingChat(config, request, callbacks) {
  const { onChunk, onDone, onError } = callbacks

  try {
    const body = {
      model: config.modelName,
      messages: request.messages,
      stream: true,
    }

    const resp = await fetch(`${config.apiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: request.signal,
    })

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '')
      const classified = classifyError(
        new Error(`HTTP ${resp.status}: ${errorText.slice(0, 300)}`),
      )
      onError(new Error(classified.message))
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const payload = trimmed.slice(6)
        if (payload === '[DONE]') break

        try {
          const parsed = JSON.parse(payload)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            fullText += delta
            onChunk(delta)
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }

    onDone(fullText)
  } catch (err) {
    if (err.name === 'AbortError') {
      onError(new Error('请求已取消'))
    } else {
      onError(err)
    }
  }
}

/**
 * Send a non-streaming chat completion request (for quick/deep modes).
 * @param {AiClientConfig} config
 * @param {AiRequest} request
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
export async function sendChat(config, request) {
  try {
    const body = {
      model: config.modelName,
      messages: request.messages,
    }

    const resp = await fetch(`${config.apiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: request.signal,
    })

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '')
      return {
        success: false,
        error: `HTTP ${resp.status}${errorText ? `: ${errorText.slice(0, 200)}` : ''}`,
      }
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''

    return { success: true, content }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: '请求已取消' }
    }
    return { success: false, ...classifyError(err) }
  }
}

/**
 * Build the system message content with spec context.
 * @param {object} specData - { name, sections: [{title, items: [{label, value, note, priority}]}] }
 * @param {'quick'|'deep'} mode
 * @param {string|null} templateSystemPrompt - Optional template's system prompt
 * @returns {string} The assembled system message content
 */
export function buildSpecContext(specData, mode, templateSystemPrompt) {
  // If a template-specific prompt is provided, use it
  if (templateSystemPrompt) {
    return buildPromptWithSpec(specData, templateSystemPrompt)
  }

  const defaultPrompt =
    mode === 'deep'
      ? '你是一个资深设计规范顾问，擅长深度分析。以下是当前品类的完整规范数据。请基于数据给出详细的、可落地的建议，包括规范依据、常见误区、优化方向。如果涉及多个规范之间的权衡，请对比分析。'
      : '你是一个设计规范助手。以下是当前品类的完整规范数据。请基于这些数据回答用户问题。如果问题超出规范范围，请注明。'

  return buildPromptWithSpec(specData, defaultPrompt)
}

/**
 * Helper: serialise spec data and prepend a system prompt.
 * @param {object} specData
 * @param {string} systemPrompt
 * @returns {string}
 */
function buildPromptWithSpec(specData, systemPrompt) {
  if (!specData || !specData.sections || specData.sections.length === 0) {
    return systemPrompt + '\n\n（暂无可用规范数据）'
  }

  const serialisedSections = specData.sections
    .map(
      (s) =>
        `### ${s.title}\n` +
        s.items
          .map(
            (i) =>
              `- ${i.label}: ${i.value}${i.note ? `（${i.note}）` : ''}[${i.priority}]`,
          )
          .join('\n'),
    )
    .join('\n\n')

  return `${systemPrompt}\n\n## ${specData.name}\n\n${serialisedSections}`
}

/**
 * Helper: determine if an error is network/timeout/auth/model-not-found
 * @param {Error|object} err
 * @returns {{ type: 'network'|'timeout'|'auth'|'model'|'rate-limit'|'cors'|'unknown', message: string }}
 */
export function classifyError(err) {
  const msg = (err?.message || String(err)).toLowerCase()

  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort')) {
    return { type: 'timeout', message: err?.message || '请求超时或已取消' }
  }

  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key')) {
    return { type: 'auth', message: 'API Key 无效或未授权' }
  }

  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
    return { type: 'rate-limit', message: '请求频率过高，请稍后再试' }
  }

  if (msg.includes('404') || msg.includes('model not found') || msg.includes('not found')) {
    return { type: 'model', message: '模型名称不存在或不可用' }
  }

  if (
    msg.includes('cors') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('fetch')
  ) {
    return { type: 'cors', message: '网络请求失败，请检查 API 端点地址和网络连接' }
  }

  return { type: 'unknown', message: err?.message || '未知错误' }
}
