import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext(null)

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme'))
  const effectiveTheme = theme || getSystemTheme()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', effectiveTheme === 'dark' ? '#1a1a2e' : '#f3f4f6')
    }
  }, [effectiveTheme])

  // Re-render when system preference changes (only matters when theme === null)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (!theme) setThemeState(null)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((value) => {
    if (value) {
      localStorage.setItem('theme', value)
    } else {
      localStorage.removeItem('theme')
    }
    setThemeState(value)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
