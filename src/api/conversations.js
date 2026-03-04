import { apiClient } from './client'

export async function listConversations() {
  const { data } = await apiClient.get('/api/conversations')
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

export async function addMessage(conversationId, { role, content }) {
  const { data } = await apiClient.post(`/api/conversations/${conversationId}/messages`, {
    role,
    content,
  })
  return data
}

export async function updateConversation(conversationId, { title }) {
  const { data } = await apiClient.patch(`/api/conversations/${conversationId}`, { title })
  return data
}

export async function deleteConversation(conversationId) {
  const { data } = await apiClient.delete(`/api/conversations/${conversationId}`)
  return data
}

