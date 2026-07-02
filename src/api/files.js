import { apiClient } from './client'

export async function uploadFile(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post('/api/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: (event) => {
      if (!event.total) return
      onProgress?.(Math.round((event.loaded / event.total) * 100))
    },
  })
  return data
}

export async function getFileMeta(fileId) {
  const { data } = await apiClient.get(`/api/files/${fileId}`)
  return data
}

export async function deleteFile(fileId) {
  const { data } = await apiClient.delete(`/api/files/${fileId}`)
  return data
}
