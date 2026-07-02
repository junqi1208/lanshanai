export const CHAT_MODELS = [
  {
    value: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    vendor: "deepseek",
    desc: "快速响应",
    hint: "响应速度快，适合日常问答、代码补全与轻量任务",
    supportsImage: false,
  },
  {
    value: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    vendor: "deepseek",
    desc: "深度推理",
    hint: "更强的逻辑推理与复杂问题分析，适合需要深度思考的场景",
    supportsImage: false,
  },
  {
    value: "qwen-plus",
    label: "Qwen Plus",
    vendor: "qwen",
    desc: "均衡文本",
    hint: "通义千问均衡型文本模型，日常对话与文档处理性价比较高",
    supportsImage: false,
  },
  {
    value: "qwen-max",
    label: "Qwen Max",
    vendor: "qwen",
    desc: "强文本",
    hint: "通义千问旗舰文本模型，复杂理解、写作与长文分析能力更强",
    supportsImage: false,
  },
  {
    value: "qwen-vl-max",
    label: "Qwen VL Max",
    vendor: "qwen",
    desc: "视觉理解",
    hint: "支持图片理解，可分析截图、照片等视觉内容，也可上传 PDF 与 Word",
    supportsImage: true,
  },
]

export const DEFAULT_CHAT_MODEL = "deepseek-v4-flash"

/** 聊天附件：单文件上限 5MB，最多 3 个 */
export const MAX_CHAT_UPLOAD_FILE_SIZE = 5 * 1024 * 1024
export const MAX_CHAT_UPLOAD_FILE_COUNT = 3

export const CHAT_MODEL_STORAGE_KEY = "lanshan-chat-model-id"

const LEGACY_PROVIDER_MAP = {
  deepseek: "deepseek-v4-flash",
  qwen: "qwen-plus",
}

export function getStoredChatModel() {
  if (typeof window === "undefined") return DEFAULT_CHAT_MODEL

  const stored = window.localStorage.getItem(CHAT_MODEL_STORAGE_KEY)
  if (stored && CHAT_MODELS.some((item) => item.value === stored)) {
    return stored
  }

  const legacy = window.localStorage.getItem("lanshan-chat-model-provider")
  if (legacy && LEGACY_PROVIDER_MAP[legacy]) {
    return LEGACY_PROVIDER_MAP[legacy]
  }

  return DEFAULT_CHAT_MODEL
}

export function storeChatModel(value) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CHAT_MODEL_STORAGE_KEY, value)
}

export function getChatModelMeta(value) {
  return CHAT_MODELS.find((item) => item.value === value) || CHAT_MODELS[0]
}

export const CHAT_MODEL_VENDORS = [
  { key: "deepseek", label: "DeepSeek" },
  { key: "qwen", label: "通义千问" },
]

export function getChatModelGroups() {
  return CHAT_MODEL_VENDORS.map((vendor) => ({
    label: vendor.label,
    options: CHAT_MODELS.filter((item) => item.vendor === vendor.key).map((item) => ({
      value: item.value,
      label: item.label,
      desc: item.desc,
    })),
  }))
}

export function getUploadAcceptByModel(modelId) {
  const meta = getChatModelMeta(modelId)
  const docs = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  const images = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
  return meta.supportsImage ? `${docs},${images}` : docs
}

export function getUploadHintByModel(modelId) {
  const meta = getChatModelMeta(modelId)
  const types = meta.supportsImage ? "PDF、Word 或图片" : "PDF 或 Word 文档"
  return `支持${types}，单个不超过 5MB，最多 ${MAX_CHAT_UPLOAD_FILE_COUNT} 个`
}

export const DOCUMENT_UPLOAD_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export const IMAGE_UPLOAD_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"

export function isImageAttachment(originalName = "", mimeType = "") {
  const lower = String(originalName).toLowerCase()
  const mime = String(mimeType).toLowerCase()
  if (mime.startsWith("image/")) return true
  return /\.(jpe?g|png|webp|gif)$/.test(lower)
}

export function modelSupportsDeepThinking(modelId) {
  return modelId === "deepseek-v4-pro"
}
