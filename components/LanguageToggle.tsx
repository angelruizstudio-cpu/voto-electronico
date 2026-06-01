"use client"

import { useI18n, type Language } from "@/lib/i18n"

const options: { language: Language; label: string; flag: string }[] = [
  { language: "es", label: "Español", flag: "🇪🇸" },
  { language: "en", label: "English", flag: "🇺🇸" },
]

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useI18n()

  return (
    <div
      className={[
        "inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm",
        className,
      ].join(" ")}
      aria-label="Language selector"
    >
      {options.map((option) => {
        const active = language === option.language

        return (
          <button
            key={option.language}
            type="button"
            onClick={() => setLanguage(option.language)}
            className={[
              "flex h-9 items-center gap-2 rounded-full px-3 text-sm font-black transition",
              active
                ? "bg-[#16382f] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            ].join(" ")}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
          >
            <span className="text-base leading-none" aria-hidden="true">
              {option.flag}
            </span>
            <span>{option.language.toUpperCase()}</span>
          </button>
        )
      })}
    </div>
  )
}
