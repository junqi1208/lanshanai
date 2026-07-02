import { useCallback, useRef, useState } from 'react'
import { Button, Progress } from 'antd'
import { CloseOutlined, InboxOutlined } from '@ant-design/icons'
import ComposerBottomPanel from './composerBottomPanel'
import {
  getUploadHintByModel,
  MAX_CHAT_UPLOAD_FILE_COUNT,
} from '@/constants/chatModels'

export default function ComposerUploadPanel({
  open,
  onClose,
  onMountChange,
  modelId,
  disabled = false,
  pendingFiles = [],
  uploading = false,
  uploadProgress = 0,
  uploadingFileName = '',
  onPickFiles,
  onUploadFiles,
  onRemoveFile,
}) {
  const atLimit = pendingFiles.length >= MAX_CHAT_UPLOAD_FILE_COUNT
  const hasPending = pendingFiles.length > 0
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  const canUpload = !disabled && !uploading && !atLimit

  const handleDragEnter = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!canUpload) return
    dragCounterRef.current += 1
    setIsDragging(true)
  }, [canUpload])

  const handleDragLeave = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    if (canUpload) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }, [canUpload])

  const handleDrop = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)
    if (!canUpload) return
    const files = event.dataTransfer?.files
    if (files?.length) {
      onUploadFiles?.(files)
    }
  }, [canUpload, onUploadFiles])

  const handleClick = useCallback(() => {
    if (!canUpload) return
    onPickFiles?.()
  }, [canUpload, onPickFiles])

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleClick()
    }
  }, [handleClick])

  return (
    <ComposerBottomPanel
      open={open}
      onClose={onClose}
      onMountChange={onMountChange}
      title="上传附件"
      size={hasPending || uploading ? 'tall' : 'default'}
      footer={getUploadHintByModel(modelId)}
    >
      <div
        role="button"
        tabIndex={canUpload ? 0 : -1}
        aria-disabled={!canUpload}
        className={`chat-composer-upload-dropzone ${isDragging ? 'is-dragging' : ''} ${!canUpload ? 'is-disabled' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <div className="chat-composer-upload-drop-hint">
          <InboxOutlined />
          <div className="chat-composer-upload-drop-text">
            <span className="chat-composer-upload-drop-title">点击或拖拽文件到此处</span>
            <span className="chat-composer-upload-drop-desc">支持文档与图片，按当前模型能力自动识别</span>
          </div>
        </div>
      </div>

      {uploading ? (
        <div className="chat-composer-upload-progress">
          <div className="chat-composer-upload-progress-head">
            <span className="chat-composer-upload-progress-label">正在上传</span>
            <span className="chat-composer-upload-progress-name" title={uploadingFileName}>
              {uploadingFileName || '文件处理中…'}
            </span>
            <span className="chat-composer-upload-progress-percent">{uploadProgress}%</span>
          </div>
          <Progress
            percent={uploadProgress}
            showInfo={false}
            strokeColor="#2563eb"
            trailColor="color-mix(in srgb, var(--app-border-color) 70%, transparent)"
            size="small"
          />
        </div>
      ) : null}

      {hasPending ? (
        <div className="chat-composer-upload-list">
          <div className="chat-composer-upload-list-title">
            已添加 {pendingFiles.length}/{MAX_CHAT_UPLOAD_FILE_COUNT}
          </div>
          {pendingFiles.map((item) => (
            <div key={item.fileId} className="chat-composer-upload-item">
              <span className="chat-composer-upload-item-name" title={item.originalName}>
                {item.originalName}
              </span>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                aria-label="移除附件"
                disabled={disabled || uploading}
                onClick={() => onRemoveFile?.(item.fileId)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </ComposerBottomPanel>
  )
}
