export const REPLY_STYLES = [
  { value: 'default', label: '默认', desc: '均衡清晰' },
  { value: 'rigorous', label: '严谨', desc: '专业准确' },
  { value: 'humorous', label: '幽默', desc: '轻松有趣' },
  { value: 'concise', label: '简洁', desc: '直击要点' },
  { value: 'detailed', label: '详尽', desc: '深入展开' },
  { value: 'warm', label: '温和', desc: '耐心亲切' },
]

export const DEFAULT_REPLY_STYLE = 'default'

export const REPLY_STYLE_STORAGE_KEY = 'lanshan-chat-reply-style'

export function getStoredReplyStyle() {
  if (typeof window === 'undefined') return DEFAULT_REPLY_STYLE
  const stored = window.localStorage.getItem(REPLY_STYLE_STORAGE_KEY)
  return REPLY_STYLES.some((item) => item.value === stored) ? stored : DEFAULT_REPLY_STYLE
}

export function storeReplyStyle(value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(REPLY_STYLE_STORAGE_KEY, value)
}
