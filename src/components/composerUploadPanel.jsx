import { useCallback, useRef, useState } from 'react'
import { Button, Progress, Typography } from 'antd'
import { CloseOutlined, CloudUploadOutlined } from '@ant-design/icons'
import ComposerBottomPanel from './composerBottomPanel'
import {
  getFileIcon,
  getFileIconClass,
  getFileTypeLabel,
} from './chatMessageAttachments'
import {
  getUploadHintByModel,
  MAX_CHAT_UPLOAD_FILE_COUNT,
} from '@/constants/chatModels'

export default function ComposerUploadPanel({
  open,
  onClose,
  onMountChange,
  modelId,
  uploadInputId,
  disabled = false,
  pendingCount = 0,
  pendingFiles = [],
  uploading = false,
  uploadProgress = 0,
  uploadingFileName = '',
  blockDismissRef,
  onUploadBlocked,
  onUploadFiles,
  onRemoveFile,
}) {
  const atLimit = pendingCount >= MAX_CHAT_UPLOAD_FILE_COUNT
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

  const handleLabelClick = useCallback((event) => {
    if (canUpload) {
      if (blockDismissRef) {
        blockDismissRef.current = true
      }
      return
    }
    event.preventDefault()
    onUploadBlocked?.()
  }, [canUpload, blockDismissRef, onUploadBlocked])

  return (
    <ComposerBottomPanel
      open={open}
      onClose={onClose}
      onMountChange={onMountChange}
      title="上传附件"
      eyebrow={hasPending ? `已选 ${pendingCount}/${MAX_CHAT_UPLOAD_FILE_COUNT}` : undefined}
      size={hasPending || uploading ? 'tall' : 'default'}
      footer={getUploadHintByModel(modelId)}
      blockDismissRef={blockDismissRef}
      className="chat-composer-upload-panel"
    >
      <label
        htmlFor={canUpload ? uploadInputId : undefined}
        className={`chat-composer-upload-dropzone ${isDragging ? 'is-dragging' : ''} ${!canUpload ? 'is-disabled' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleLabelClick}
      >
        <div className="chat-composer-upload-drop-icon-wrap">
          <CloudUploadOutlined />
        </div>
        <div className="chat-composer-upload-drop-text">
          <span className="chat-composer-upload-drop-title">
            {isDragging ? '松开即可上传' : '点击或拖拽文件到此处'}
          </span>
          <span className="chat-composer-upload-drop-desc">
            支持文档与图片，按当前模型能力自动识别
          </span>
        </div>
      </label>

      {uploading ? (
        <div className="chat-composer-upload-progress">
          <div className="chat-composer-upload-progress-head">
            <Typography.Text className="chat-composer-upload-progress-label">正在上传</Typography.Text>
            <Typography.Text
              className="chat-composer-upload-progress-name"
              ellipsis={{ tooltip: uploadingFileName }}
            >
              {uploadingFileName || '文件处理中…'}
            </Typography.Text>
            <Typography.Text className="chat-composer-upload-progress-percent">
              {uploadProgress}%
            </Typography.Text>
          </div>
          <Progress
            percent={uploadProgress}
            showInfo={false}
            strokeColor={{ from: '#60a5fa', to: '#2563eb' }}
            trailColor="color-mix(in srgb, var(--app-border-color) 65%, transparent)"
            size="small"
          />
        </div>
      ) : null}

      {hasPending ? (
        <div className="chat-composer-upload-list">
          <div className="chat-composer-upload-list-head">
            <span className="chat-composer-upload-list-title">待发送附件</span>
            <span className="chat-composer-upload-list-count">
              {pendingCount}/{MAX_CHAT_UPLOAD_FILE_COUNT}
            </span>
          </div>
          <div className="chat-composer-upload-list-items">
            {pendingFiles.map((item) => (
              <div key={item.fileId} className="chat-composer-upload-item">
                <div className={`chat-composer-upload-item-icon ${getFileIconClass(item.originalName, item.mimeType)}`}>
                  {getFileIcon(item.originalName, item.mimeType)}
                </div>
                <div className="chat-composer-upload-item-meta">
                  <span className="chat-composer-upload-item-name" title={item.originalName}>
                    {item.originalName}
                  </span>
                  <span className="chat-composer-upload-item-type">
                    {getFileTypeLabel(item.originalName, item.mimeType)}
                  </span>
                </div>
                <Button
                  type="text"
                  size="small"
                  className="chat-composer-upload-item-remove"
                  icon={<CloseOutlined />}
                  aria-label="移除附件"
                  disabled={disabled || uploading}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemoveFile?.(item.fileId)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </ComposerBottomPanel>
  )
}
