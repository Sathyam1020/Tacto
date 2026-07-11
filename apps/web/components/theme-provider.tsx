"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * The Linear design system ships light + dark. We toggle via the `.dark` class
 * (next-themes persists the choice to localStorage). Dark is the default; the
 * OS preference is ignored so the app has one deliberate default until the user
 * chooses. The toggle lives in the account dropdown.
 */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
