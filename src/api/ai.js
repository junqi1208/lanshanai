import { apiClient } from "./client"
import { getApiErrorMessage } from "@/utils/getApiErrorMessage"
import { clearToken, getToken } from "./token"

export async function ask({ conversationId, prompt, deepThinking, fileIds, replyStyle, modelId }) {
  const { data } = await apiClient.post("/api/ai/ask", {
    conversationId,
    prompt,
    deepThinking,
    fileIds,
    replyStyle,
    modelId,
  })
  return data
}

export async function summarizeConversationTitle({ conversationId }) {
  const { data } = await apiClient.post("/api/ai/summarize-title", { conversationId })
  return data
}

export async function askStream(
  { conversationId, prompt, deepThinking, fileIds, replyStyle, modelId },
  { onStart, onDelta, onReasoning, onDone, onError, signal } = {},
) {
  const token = getToken()
  const resp = await fetch("/api/ai/ask/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ conversationId, prompt, deepThinking, fileIds, replyStyle, modelId }),
    signal,
  })

  if (!resp.ok || !resp.body) {
    if (resp.status === 401 && typeof window !== "undefined") {
      clearToken()
      window.dispatchEvent(new CustomEvent("auth:logout"))
    }
    const txt = await resp.text().catch(() => "")
    throw new Error(getApiErrorMessage(txt, `请求失败（${resp.status}）`))
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let streamError = null
  let gotDone = false

  const handleEventChunk = (chunkText) => {
    const lines = chunkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    const dataLines = lines.filter((line) => line.startsWith("data:"))
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

      if (payload?.type === "start") onStart?.(payload)
      if (payload?.type === "delta") onDelta?.(payload.delta || "")
      if (payload?.type === "reasoning") onReasoning?.(payload.delta || "")
      if (payload?.type === "done") {
        gotDone = true
        onDone?.(payload)
      }
      if (payload?.type === "error") {
        streamError = payload.message || "流式请求失败"
        onError?.(streamError)
      }
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split(/\r?\n\r?\n/)
      buffer = chunks.pop() || ""

      for (const chunk of chunks) {
        handleEventChunk(chunk)
      }
    }

    if (buffer.trim()) {
      handleEventChunk(buffer)
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // ignore cancel failure
    }
  }

  if (streamError && !gotDone) {
    throw new Error(streamError)
  }
}
