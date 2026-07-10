"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { Toaster } from "sonner"

import { TooltipProvider } from "@workspace/ui/components/tooltip"

/**
 * Client-side providers. The QueryClient lives in state so it is created
 * once per browser session and never shared between SSR requests.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            // Don't refetch on tab focus — it regenerates presigned
            // screenshot URLs and makes images (and their pointers) flash.
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  const { resolvedTheme } = useTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        position="bottom-right"
        toastOptions={{ className: "font-sans" }}
      />
    </QueryClientProvider>
  )
}
