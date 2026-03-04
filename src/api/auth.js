import { apiClient } from './client'

export async function register({ username, password }) {
  const { data } = await apiClient.post('/api/auth/register', { username, password })
  return data
}

export async function login({ username, password }) {
  const { data } = await apiClient.post('/api/auth/login', { username, password })
  return data
}

export async function me() {
  const { data } = await apiClient.get('/api/users/me')
  return data
}

export async function updateMe({ nickname, gender, avatar }) {
  const { data } = await apiClient.patch('/api/users/me', { nickname, gender, avatar })
  return data
}

