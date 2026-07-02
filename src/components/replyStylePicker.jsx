import { useEffect, useRef } from 'react'
import { CloseOutlined } from '@ant-design/icons'
import { REPLY_STYLES } from '@/constants/replyStyles'

function useReplyStyleSwitcher({ open, onOpenChange }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.chat-style-neon-trigger')) return
      onOpenChange?.(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, onOpenChange])

  return { panelRef }
}

export function ReplyStylePanel({
  value,
  onChange,
  open,
  onOpenChange,
  disabled = false,
}) {
  const { panelRef } = useReplyStyleSwitcher({ open, onOpenChange })
  const activeStyle = REPLY_STYLES.find((item) => item.value === value) || REPLY_STYLES[0]

  const handlePick = (nextValue) => {
    onChange?.(nextValue)
    onOpenChange?.(false)
  }

  return (
    <div
      ref={panelRef}
      className={`chat-main-style-panel ${open ? 'is-open' : ''}`}
      aria-hidden={!open}
    >
      <div className="chat-main-style-panel-inner">
        <div className="chat-main-style-panel-head">
          <div className="chat-main-style-panel-title-wrap">
            <span className="chat-main-style-panel-eyebrow">Reply Tone</span>
            <span className="chat-main-style-panel-title">选择回答风格</span>
          </div>
          <button
            type="button"
            className="chat-main-style-panel-close"
            aria-label="关闭风格面板"
            onClick={() => onOpenChange?.(false)}
          >
            <CloseOutlined />
          </button>
        </div>
        <div className="chat-main-style-panel-grid" role="radiogroup" aria-label="回答风格">
          {REPLY_STYLES.map((item) => {
            const active = value === item.value
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                className={`chat-main-style-card ${active ? 'is-active' : ''}`}
                onClick={() => handlePick(item.value)}
              >
                <span className="chat-main-style-card-glow" aria-hidden="true" />
                <span className="chat-main-style-card-label">{item.label}</span>
                <span className="chat-main-style-card-desc">{item.desc}</span>
              </button>
            )
          })}
        </div>
        <div className="chat-main-style-panel-foot">
          当前：<strong>{activeStyle.label}</strong> · {activeStyle.desc}
        </div>
      </div>
    </div>
  )
}

export function ReplyStyleNeonTrigger({ value, open, onOpenChange, disabled = false }) {
  const activeStyle = REPLY_STYLES.find((item) => item.value === value) || REPLY_STYLES[0]

  return (
    <button
      type="button"
      className={`chat-style-neon-trigger ${open ? 'is-open' : ''}`}
      disabled={disabled}
      aria-expanded={open}
      aria-label="选择回答风格"
      title={`当前风格：${activeStyle.label}`}
      onClick={() => onOpenChange?.(!open)}
    >
      <span className="chat-style-neon-text">风格</span>
    </button>
  )
}

export default function ReplyStyleSwitcher(props) {
  return (
    <>
      <ReplyStylePanel {...props} />
      <ReplyStyleNeonTrigger {...props} />
    </>
  )
}
