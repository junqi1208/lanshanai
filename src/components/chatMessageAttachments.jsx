import { FileOutlined, FilePdfOutlined, FileWordOutlined, PictureOutlined } from "@ant-design/icons"

export function getFileTypeLabel(originalName = "", mimeType = "") {
  const lower = String(originalName).toLowerCase()
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "PDF 文档"
  if (
    lower.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "Word 文档"
  }
  if (mimeType.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/.test(lower)) {
    return "图片"
  }
  return "文档"
}

function getFileIcon(originalName = "", mimeType = "") {
  const lower = String(originalName).toLowerCase()
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    return <FilePdfOutlined />
  }
  if (
    lower.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return <FileWordOutlined />
  }
  if (mimeType.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/.test(lower)) {
    return <PictureOutlined />
  }
  return <FileOutlined />
}

function getFileIconClass(originalName = "", mimeType = "") {
  const lower = String(originalName).toLowerCase()
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "is-pdf"
  if (
    lower.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "is-word"
  }
  if (mimeType.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/.test(lower)) {
    return "is-image"
  }
  return "is-default"
}

export default function ChatMessageAttachments({ files = [] }) {
  if (!files?.length) return null

  return (
    <div className="chat-user-attachments-scroll">
      <div className="chat-user-attachments-track">
        {files.map((file) => {
          const name = file.originalName || "未命名文件"
          const mimeType = file.mimeType || ""
          return (
            <div key={file.fileId || name} className="chat-user-attachment-chip">
              <div className={`chat-user-attachment-icon ${getFileIconClass(name, mimeType)}`}>
                {getFileIcon(name, mimeType)}
              </div>
              <div className="chat-user-attachment-meta">
                <div className="chat-user-attachment-name" title={name}>
                  {name}
                </div>
                <div className="chat-user-attachment-type">{getFileTypeLabel(name, mimeType)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function parseMessageAttachments(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}
