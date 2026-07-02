export const EMPTY_HERO_TEXT = '我是览山，需要为您做点什么？'

const PUNCTUATION = new Set(['，', '。', '？', '！', '、'])

/** 逐字间隔：非匀速，带标点停顿与随机抖动 */
function delayBeforeChar(char, index, prevChar) {
  if (prevChar && PUNCTUATION.has(prevChar)) {
    if (prevChar === '，') return 260 + Math.random() * 160
    if (prevChar === '？') return 180 + Math.random() * 100
    return 200 + Math.random() * 120
  }

  if (char === '，') return 38 + Math.random() * 32
  if (char === '？') return 42 + Math.random() * 36

  if (index <= 1) return 82 + Math.random() * 58
  if (index <= 3) return 52 + Math.random() * 38
  if (index <= 8) return 46 + Math.random() * 34
  if (index <= 11) return 54 + Math.random() * 44
  return 62 + Math.random() * 48
}

export function buildEmptyHeroTypewriterSchedule(text = EMPTY_HERO_TEXT) {
  const stamps = []
  let elapsed = 0
  for (let i = 0; i < text.length; i += 1) {
    const prev = i > 0 ? text[i - 1] : ''
    elapsed += delayBeforeChar(text[i], i, prev)
    stamps.push(elapsed)
  }
  return stamps
}

/**
 * 使用 rAF 驱动打字机，避免 setTimeout 链式卡顿。
 * @returns {() => void} cancel
 */
export function startEmptyHeroTypewriter({
  delayMs = 0,
  onUpdate,
  schedule = buildEmptyHeroTypewriterSchedule(),
  text = EMPTY_HERO_TEXT,
}) {
  let cancelled = false
  let rafId = 0
  let shown = 0
  let lastEmitted = 0
  const startAt = performance.now() + delayMs

  const tick = (now) => {
    if (cancelled) return

    const elapsed = now - startAt
    if (elapsed < 0) {
      rafId = requestAnimationFrame(tick)
      return
    }

    while (shown < schedule.length && schedule[shown] <= elapsed) {
      shown += 1
    }

    if (shown !== lastEmitted) {
      lastEmitted = shown
      onUpdate(text.slice(0, shown))
    }

    if (shown < schedule.length) {
      rafId = requestAnimationFrame(tick)
    }
  }

  rafId = requestAnimationFrame(tick)

  return () => {
    cancelled = true
    cancelAnimationFrame(rafId)
  }
}
