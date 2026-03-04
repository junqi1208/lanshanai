import axios from 'axios'
import { clearToken, getToken } from './token'

export const apiClient = axios.create({
  baseURL: '',
  timeout: 60000,
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (resp) => resp,
  (err) => {
    const status = err?.response?.status
    if (status === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('auth:logout'))
    }
    return Promise.reject(err)
  },
)

