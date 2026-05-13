"use client"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ReactNode } from "react"
import type { ThemeProviderProps as NextThemeProviderProps } from "next-themes"

type AppThemeProviderProps = NextThemeProviderProps & {
  children?: ReactNode
}

export function ThemeProvider({ children, ...props }: AppThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
