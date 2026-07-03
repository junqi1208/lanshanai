export const LOGIN_BACKGROUND_URL = '/beijing.JPG'

let preloaded = false

/** 尽早拉取登录页背景图，避免首次进入 /login 时才触发 CSS 背景请求 */
export function preloadLoginBackground() {
  if (preloaded || typeof window === 'undefined') return
  preloaded = true

  const img = new Image()
  img.decoding = 'async'
  if ('fetchPriority' in img) {
    img.fetchPriority = 'high'
  }
  img.src = LOGIN_BACKGROUND_URL
}
