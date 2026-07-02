const GENERIC_HTTP_RE = /^Request failed with status code \d+$/
const HTTP_STATUS_RE = /^HTTP \d+$/

function readMessageFromPayload(data) {
  if (!data || typeof data !== 'object') return ''
  const msg = data.message
  if (typeof msg === 'string' && msg.trim()) return msg.trim()
  if (Array.isArray(msg) && msg.length) return msg.filter(Boolean).join('; ')
  return ''
}

function readMessageFromText(text) {
  if (!text || typeof text !== 'string') return ''
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      const fromPayload = readMessageFromPayload(parsed)
      if (fromPayload) return fromPayload
    } catch {
      // ignore invalid JSON
    }
  }
  return trimmed
}

/**
 * 从 API / axios / fetch 错误中提取后端 message，避免展示 "Request failed with status code 400" 等
 */
export function getApiErrorMessage(error, fallback = '操作失败，请稍后重试') {
  if (!error) return fallback

  const fromResponse = readMessageFromPayload(error?.response?.data)
  if (fromResponse) return fromResponse

  if (typeof error === 'string') {
    const fromText = readMessageFromText(error)
    if (fromText && !GENERIC_HTTP_RE.test(fromText) && !HTTP_STATUS_RE.test(fromText)) {
      return fromText
    }
  }

  if (error?.message) {
    const msg = error.message
    if (!GENERIC_HTTP_RE.test(msg) && !HTTP_STATUS_RE.test(msg)) {
      return msg
    }
    const fromJson = readMessageFromText(msg)
    if (fromJson && !GENERIC_HTTP_RE.test(fromJson) && !HTTP_STATUS_RE.test(fromJson)) {
      return fromJson
    }
  }

  return fallback
}

export function normalizeAxiosError(err) {
  if (!err) return err

  const payload = err?.response?.data
  const message = readMessageFromPayload(payload) || readMessageFromText(typeof payload === 'string' ? payload : '')

  if (message) {
    err.message = message
  }

  if (payload && typeof payload === 'object' && payload.code != null) {
    err.code = Number(payload.code)
  } else if (err?.response?.status) {
    err.code = err.response.status
  }

  return err
}
