"use client"

import { I18nProvider } from "@/lib/i18n"
import { AsambleaProvider } from "@/hooks/useAsamblea"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AsambleaProvider>
      <I18nProvider>{children}</I18nProvider>
    </AsambleaProvider>
  )
}
