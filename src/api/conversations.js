import { apiClient } from './client'

export async function listConversations({ page = 1, pageSize = 20 } = {}) {
  const { data } = await apiClient.get('/api/conversations', {
    params: { page, pageSize },
  })
  return data
}

export async function createConversation({ title } = {}) {
  const { data } = await apiClient.post('/api/conversations', { title })
  return data
}

export async function listMessages(conversationId) {
  const { data } = await apiClient.get(`/api/conversations/${conversationId}/messages`)
  return data
}

export async function addMessage(conversationId, { role, content, reasoning }) {
  const { data } = await apiClient.post(`/api/conversations/${conversationId}/messages`, {
    role,
    content,
    reasoning,
  })
  return data
}

export async function updateConversation(conversationId, payload = {}) {
  const { data } = await apiClient.patch(`/api/conversations/${conversationId}`, payload)
  return data
}

export async function deleteConversation(conversationId) {
  const { data } = await apiClient.delete(`/api/conversations/${conversationId}`)
  return data
}

