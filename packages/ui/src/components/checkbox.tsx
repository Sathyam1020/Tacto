"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Checkbox — base-ui + Linear styling. The indicator is kept mounted so the
 * check can scale/animate in and out (a small satisfying pop on select).
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-[18px] shrink-0 rounded-[6px] border border-input bg-background shadow-xs outline-none transition-[background-color,border-color,transform,box-shadow] duration-150 active:scale-90",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
        "data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        keepMounted
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-[transform,opacity] duration-150 ease-out data-[unchecked]:scale-50 data-[unchecked]:opacity-0 data-[checked]:scale-100 data-[checked]:opacity-100"
      >
        <Check className="size-3" strokeWidth={3.25} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
