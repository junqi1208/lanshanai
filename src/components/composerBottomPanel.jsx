import { useEffect } from 'react'
import { CloseOutlined } from '@ant-design/icons'
import useComposerPanelDismiss from '@/hooks/useComposerPanelDismiss'
import useComposerPanelAnimation from '@/hooks/useComposerPanelAnimation'

export default function ComposerBottomPanel({
  open,
  onClose,
  onMountChange,
  eyebrow,
  title,
  footer,
  children,
  className = '',
  size = 'default',
  blockDismissRef,
}) {
  const { mounted, visible } = useComposerPanelAnimation(open)
  const { panelRef } = useComposerPanelDismiss({ open: visible, onClose, blockDismissRef })

  useEffect(() => {
    onMountChange?.(mounted)
  }, [mounted, onMountChange])

  if (!mounted) return null

  return (
    <div
      ref={panelRef}
      className={`chat-composer-bottom-panel ${visible ? 'is-open' : 'is-closing'} ${size === 'tall' ? 'is-tall' : ''} ${className}`.trim()}
      aria-hidden={!visible}
    >
      <div className="chat-composer-bottom-panel-clip">
        <div className="chat-composer-bottom-panel-inner">
          <div className="chat-composer-bottom-panel-head">
            <div className="chat-composer-bottom-panel-title-wrap">
              {eyebrow ? <span className="chat-composer-bottom-panel-eyebrow">{eyebrow}</span> : null}
              {title ? <span className="chat-composer-bottom-panel-title">{title}</span> : null}
            </div>
            <button
              type="button"
              className="chat-composer-bottom-panel-close"
              aria-label="关闭面板"
              onClick={() => onClose?.()}
            >
              <CloseOutlined />
            </button>
          </div>
          <div className="chat-composer-bottom-panel-body">{children}</div>
          {footer ? <div className="chat-composer-bottom-panel-foot">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}
