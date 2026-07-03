import { useEffect, useRef } from 'react'

const PANEL_TRIGGER_SELECTORS = [
  '.chat-style-neon-trigger',
  '.chat-main-attach-btn',
]

export default function useComposerPanelDismiss({ open, onClose, blockDismissRef }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (blockDismissRef?.current) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (target instanceof HTMLInputElement && target.type === 'file') return
      if (panelRef.current?.contains(target)) return
      if (target instanceof Element) {
        const hitTrigger = PANEL_TRIGGER_SELECTORS.some((selector) => target.closest(selector))
        if (hitTrigger) return
      }
      onClose?.()
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, onClose])

  return { panelRef }
}
