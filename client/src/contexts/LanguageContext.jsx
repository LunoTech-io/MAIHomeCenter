import { createContext, useContext, useState, useCallback } from 'react'
import nl from '../translations/nl'
import en from '../translations/en'

const LanguageContext = createContext(null)

const translations = { nl, en }

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem('language') || 'nl')

  const setLanguage = useCallback((lang) => {
    localStorage.setItem('language', lang)
    setLanguageState(lang)
  }, [])

  const t = useCallback((key) => {
    return translations[language]?.[key]
      || translations[language === 'nl' ? 'en' : 'nl']?.[key]
      || key
  }, [language])

  const tRoom = useCallback((name) => {
    if (!name) return name
    const key = `room.${name}`
    const val = translations[language]?.[key] || translations[language === 'nl' ? 'en' : 'nl']?.[key]
    return val || name
  }, [language])

  const tAppliance = useCallback((name) => {
    if (!name) return name
    const key = `appliance.${name}`
    const val = translations[language]?.[key] || translations[language === 'nl' ? 'en' : 'nl']?.[key]
    return val || name
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tRoom, tAppliance }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
