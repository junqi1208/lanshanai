import mermaid from 'mermaid'
import { useEffect, useId, useRef } from 'react'

let renderSeq = 0

export default function MermaidDiagram({ chart, theme = 'light', className = '' }) {
  const containerRef = useRef(null)
  const reactId = useId().replace(/:/g, '')

  useEffect(() => {
    const container = containerRef.current
    if (!container || !chart?.trim()) return undefined

    let cancelled = false
    renderSeq += 1
    const renderId = `mermaid-${reactId}-${renderSeq}`

    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      flowchart: {
        curve: 'basis',
        htmlLabels: true,
        padding: 16,
      },
      sequence: {
        diagramMarginX: 12,
        diagramMarginY: 8,
        actorMargin: 48,
        width: 150,
        boxMargin: 8,
        boxTextMargin: 6,
        noteMargin: 8,
        messageMargin: 28,
        mirrorActors: false,
      },
    })

    const renderChart = async () => {
      try {
        const { svg } = await mermaid.render(renderId, chart.trim())
        if (!cancelled && container) {
          container.innerHTML = svg
        }
      } catch {
        if (!cancelled && container) {
          container.innerHTML = '<p class="mermaid-diagram-error">架构图渲染失败，请刷新重试</p>'
        }
      }
    }

    container.innerHTML = ''
    renderChart()

    return () => {
      cancelled = true
    }
  }, [chart, theme, reactId])

  return (
    <div
      ref={containerRef}
      className={['mermaid-diagram', className].filter(Boolean).join(' ')}
      aria-hidden={false}
    />
  )
}
