import { useEffect, useState } from 'react'

export const COMPOSER_PANEL_ANIM_MS = 480

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function useComposerPanelAnimation(open) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      if (prefersReducedMotion()) {
        setVisible(true)
        return undefined
      }
      let raf2
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        if (raf2) cancelAnimationFrame(raf2)
      }
    }

    setVisible(false)
    if (prefersReducedMotion()) {
      setMounted(false)
    }
    return undefined
  }, [open])

  useEffect(() => {
    if (!mounted || visible) return undefined
    const timer = window.setTimeout(() => setMounted(false), COMPOSER_PANEL_ANIM_MS)
    return () => window.clearTimeout(timer)
  }, [mounted, visible])

  return { mounted, visible }
}
