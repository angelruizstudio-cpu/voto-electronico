"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

export type Language = "es" | "en"

const STORAGE_KEY = "voto_app_language"

type I18nContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (es: string, en: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "es"

    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved === "es" || saved === "en" ? saved : "es"
  })

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    localStorage.setItem(STORAGE_KEY, nextLanguage)
    document.documentElement.lang = nextLanguage
  }

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (es, en) => (language === "es" ? es : en),
    }),
    [language]
  )

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider")
  }

  return context
}
