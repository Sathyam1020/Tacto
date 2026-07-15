import {
  AlignLeft,
  Calendar,
  ChevronDownSquare,
  CircleDot,
  Hash,
  ListChecks,
  Mail,
  Phone,
  Star,
  Text,
  Type,
  type LucideIcon,
} from "lucide-react"

import {
  fieldConfigSchema,
  type FieldType,
  type FormField,
} from "@workspace/contracts/form"

/** Display metadata for each field type (palette + field list + preview). */
export const FIELD_TYPES: Record<
  FieldType,
  { label: string; description: string; icon: LucideIcon }
> = {
  statement: { label: "Statement", description: "Display text, no input", icon: Text },
  short_text: { label: "Short Text", description: "Single-line answer", icon: Type },
  long_text: { label: "Long Text", description: "Paragraph answer", icon: AlignLeft },
  email: { label: "Email", description: "Email address", icon: Mail },
  phone: { label: "Phone Number", description: "Phone number", icon: Phone },
  number: { label: "Number", description: "Numeric answer", icon: Hash },
  single_select: { label: "Single Choice", description: "Pick one option", icon: CircleDot },
  multi_select: { label: "Multiple Choice", description: "Pick several", icon: ListChecks },
  dropdown: { label: "Dropdown", description: "Select from a list", icon: ChevronDownSquare },
  rating: { label: "Rating", description: "Star rating", icon: Star },
  date: { label: "Date", description: "Pick a date", icon: Calendar },
}

/** The order field types appear in the palette. */
export const FIELD_TYPE_ORDER: FieldType[] = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "single_select",
  "multi_select",
  "dropdown",
  "rating",
  "date",
  "statement",
]

/** Types that carry a list of choice options. */
export const CHOICE_TYPES: FieldType[] = [
  "single_select",
  "multi_select",
  "dropdown",
]

let optionCounter = 0
function optionKey(): string {
  optionCounter += 1
  return `opt_${Date.now().toString(36)}_${optionCounter}`
}

/** Build a fresh field of the given type with sensible defaults. */
export function newField(type: FieldType): FormField {
  const config = fieldConfigSchema.parse({})
  if (CHOICE_TYPES.includes(type)) {
    config.options = [
      { key: optionKey(), label: "Option 1" },
      { key: optionKey(), label: "Option 2" },
    ]
  }
  if (type === "rating") config.max = 5
  if (type === "statement") config.buttonText = "Continue"
  return {
    key: crypto.randomUUID(),
    type,
    title: type === "statement" ? "Statement" : "Your question here",
    description: "",
    required: false,
    config,
  }
}

/** A blank choice option (for the settings editor). */
export function newOption(index: number): { key: string; label: string } {
  return { key: optionKey(), label: `Option ${index}` }
}
