import { useCallback, useEffect, useMemo, useState } from 'react'

const THEME_MODE_STORAGE_KEY = 'lanshanai_theme_mode'
const SYSTEM_THEME_MEDIA = '(prefers-color-scheme: dark)'

const normalizeThemeMode = (mode) => {
  if (mode === 'light' || mode === 'dark' || mode === 'system') return mode
  return 'system'
}

const getSystemResolvedTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia(SYSTEM_THEME_MEDIA).matches ? 'dark' : 'light'
}

const getResolvedTheme = (themeMode) => {
  if (themeMode === 'system') return getSystemResolvedTheme()
  return themeMode
}

export default function useThemeMode() {
  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window === 'undefined') return 'system'
    return normalizeThemeMode(localStorage.getItem(THEME_MODE_STORAGE_KEY))
  })
  const [resolvedTheme, setResolvedTheme] = useState(() => getResolvedTheme(themeMode))

  const applyThemeMode = useCallback((nextMode) => {
    setThemeMode(normalizeThemeMode(nextMode))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const normalized = normalizeThemeMode(themeMode)
    const nextResolved = getResolvedTheme(normalized)
    setResolvedTheme(nextResolved)
    localStorage.setItem(THEME_MODE_STORAGE_KEY, normalized)
    document.documentElement.setAttribute('data-theme', nextResolved)
  }, [themeMode])

  useEffect(() => {
    if (typeof window === 'undefined' || themeMode !== 'system') return
    const mediaQuery = window.matchMedia(SYSTEM_THEME_MEDIA)
    const handleChange = () => {
      const nextResolved = mediaQuery.matches ? 'dark' : 'light'
      setResolvedTheme(nextResolved)
      document.documentElement.setAttribute('data-theme', nextResolved)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [themeMode])

  return useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      applyThemeMode,
    }),
    [applyThemeMode, resolvedTheme, themeMode],
  )
}

