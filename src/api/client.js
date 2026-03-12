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
  (resp) => {
    const payload = resp?.data
    const isWrappedResponse =
      payload &&
      typeof payload === 'object' &&
      Object.prototype.hasOwnProperty.call(payload, 'code') &&
      Object.prototype.hasOwnProperty.call(payload, 'message') &&
      Object.prototype.hasOwnProperty.call(payload, 'data')

    if (!isWrappedResponse) {
      return resp
    }

    const code = Number(payload.code)
    if (code === 200) {
      return {
        ...resp,
        data: payload.data,
      }
    }

    const businessError = new Error(payload.message || '请求失败')
    businessError.response = {
      ...resp,
      data: payload,
    }
    return Promise.reject(businessError)
  },
  (err) => {
    const status = err?.response?.status
    if (status === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('auth:logout'))
    }
    return Promise.reject(err)
  },
)

