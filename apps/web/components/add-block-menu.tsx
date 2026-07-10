"use client"

import * as React from "react"
import type { BlockType } from "@workspace/contracts/guide"
import { Heading1, Info, SquarePlus, TriangleAlert } from "lucide-react"

import { PlusIcon } from "@workspace/ui/components/plus"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

/**
 * The `+` affordance between blocks. Opens a menu to insert a Step, Heading,
 * Tip, or Alert at this position. (Capture is deferred until the extension.)
 */

const OPTIONS: {
  type: BlockType
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { type: "STEP", label: "Step", icon: SquarePlus },
  { type: "HEADING", label: "Heading", icon: Heading1 },
  { type: "TIP", label: "Tip", icon: Info },
  { type: "ALERT", label: "Alert", icon: TriangleAlert },
]

export function AddBlockMenu({
  onAdd,
}: {
  onAdd: (type: BlockType) => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="group relative flex h-6 items-center justify-center">
      {/* Hairline that reveals on hover */}
      <div className="bg-border absolute inset-x-0 top-1/2 h-px opacity-0 transition-opacity group-hover:opacity-100" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label="Add block"
          className="bg-viridian relative z-10 flex size-6 items-center justify-center rounded-full text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 data-[popup-open]:opacity-100"
        >
          <PlusIcon size={15} />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="center">
          <div className="flex gap-1">
            {OPTIONS.map((option) => (
              <button
                key={option.type}
                onClick={() => {
                  onAdd(option.type)
                  setOpen(false)
                }}
                className="hover:bg-muted flex w-16 flex-col items-center gap-1.5 rounded-lg px-2 py-2.5 text-xs transition-colors"
              >
                <option.icon className="size-4" />
                {option.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
