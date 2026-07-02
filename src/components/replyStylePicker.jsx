import { REPLY_STYLES } from '@/constants/replyStyles'
import ComposerBottomPanel from './composerBottomPanel'

export function ReplyStylePanel({
  value,
  onChange,
  open,
  onOpenChange,
  onMountChange,
  disabled = false,
}) {
  const activeStyle = REPLY_STYLES.find((item) => item.value === value) || REPLY_STYLES[0]

  const handlePick = (nextValue) => {
    onChange?.(nextValue)
    onOpenChange?.(false)
  }

  return (
    <ComposerBottomPanel
      open={open}
      onClose={() => onOpenChange?.(false)}
      onMountChange={onMountChange}
      title="选择回答风格"
      footer={
        <>
          当前：<strong>{activeStyle.label}</strong> · {activeStyle.desc}
        </>
      }
    >
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
    </ComposerBottomPanel>
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
