import { apiClient } from './client'

export async function createShareLink({ conversationId, groupIds }) {
  const { data } = await apiClient.post('/api/shares', { conversationId, groupIds })
  return data
}

export async function getShareDetail(token) {
  const { data } = await apiClient.get(`/api/shares/${token}`)
  return data
}

