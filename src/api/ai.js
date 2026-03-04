import { apiClient } from './client'
import { clearToken, getToken } from './token'

export async function ask({ conversationId, prompt }) {
  const { data } = await apiClient.post('/api/ai/ask', { conversationId, prompt })
  return data
}

export async function summarizeConversationTitle({ conversationId }) {
  const { data } = await apiClient.post('/api/ai/summarize-title', { conversationId })
  return data
}

export async function askStream(
  { conversationId, prompt },
  { onStart, onDelta, onDone, onError, signal } = {},
) {
  const token = getToken()
  const resp = await fetch('/api/ai/ask/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ conversationId, prompt }),
    signal,
  })

  if (!resp.ok || !resp.body) {
    if (resp.status === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('auth:logout'))
    }
    const txt = await resp.text().catch(() => '')
    throw new Error(txt || `HTTP ${resp.status}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const handleEventChunk = (chunkText) => {
    const lines = chunkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    const dataLines = lines.filter((line) => line.startsWith('data:'))
    if (!dataLines.length) return

    for (const dataLine of dataLines) {
      const payloadText = dataLine.slice(5).trim()
      if (!payloadText) continue

      let payload = null
      try {
        payload = JSON.parse(payloadText)
      } catch {
        continue
      }

      if (payload?.type === 'start') onStart?.(payload)
      if (payload?.type === 'delta') onDelta?.(payload.delta || '')
      if (payload?.type === 'done') onDone?.(payload)
      if (payload?.type === 'error') onError?.(payload.message || '流式请求失败')
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split(/\r?\n\r?\n/)
    buffer = chunks.pop() || ''

    for (const chunk of chunks) {
      handleEventChunk(chunk)
    }
  }

  if (buffer.trim()) {
    handleEventChunk(buffer)
  }
}

