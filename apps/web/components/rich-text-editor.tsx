"use client"

import * as React from "react"
import Link from "@tiptap/extension-link"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Bold,
  Heading1,
  Italic,
  Link2,
  List,
  Strikethrough,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Inline rich-text editor (TipTap) — the popover that opens when a block's
 * text is clicked in the editor. Toolbar: H1, bold, italic, strike, list,
 * link. Save with ⌘↵.
 */
export function RichTextEditor({
  initialHtml,
  onSave,
  onCancel,
}: {
  initialHtml: string
  onSave: (html: string) => void
  onCancel: () => void
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: initialHtml || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "min-h-24 max-h-80 overflow-y-auto px-3 py-2.5 font-sans text-[17px] leading-relaxed outline-none [&_strong]:font-semibold [&_h1]:font-serif [&_h1]:text-2xl [&_h1]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
      },
    },
  })

  const save = React.useCallback(() => {
    if (!editor) return
    onSave(editor.getHTML())
  }, [editor, onSave])

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        save()
      }
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [save, onCancel])

  if (!editor) return null

  function setLink() {
    const previous = editor!.getAttributes("link").href as string | undefined
    const url = window.prompt("Link URL", previous ?? "https://")
    if (url === null) return
    if (url === "") {
      editor!.chain().focus().unsetLink().run()
      return
    }
    editor!.chain().focus().setLink({ href: url }).run()
  }

  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <div className="flex items-center gap-0.5 border-b p-1">
        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          label="Heading"
        >
          <Heading1 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="Strikethrough"
        >
          <Strikethrough className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={setLink}
          label="Link"
        >
          <Link2 className="size-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <div className="flex items-center gap-2 border-t p-2">
        <Button size="sm" onClick={save}>
          Save
          <Kbd className="ml-1">⌘↵</Kbd>
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Separator orientation="vertical" className="!h-4" />
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "hover:bg-muted flex size-7 items-center justify-center rounded-md transition-colors",
        active && "bg-muted text-viridian"
      )}
    >
      {children}
    </button>
  )
}
