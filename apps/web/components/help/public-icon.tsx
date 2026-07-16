import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Code2,
  CreditCard,
  Gauge,
  Globe,
  Heart,
  LifeBuoy,
  Lock,
  Mail,
  MessageSquare,
  Package,
  Play,
  Puzzle,
  Rocket,
  Settings2,
  Shield,
  Sparkles,
  Star,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"

/**
 * Public collection-icon resolver — a small, tree-shaken curated set (the
 * suggested icons) so the public help site stays lean. Uncommon builder icons
 * fall back to a book. The full library lives only in the owner builder.
 */
const MAP: Record<string, LucideIcon> = {
  Rocket,
  BookOpen,
  Users,
  BarChart3,
  Code2,
  LifeBuoy,
  Settings2,
  Zap,
  Shield,
  CreditCard,
  Puzzle,
  MessageSquare,
  Lock,
  Wrench,
  Bell,
  Star,
  Heart,
  Globe,
  Mail,
  Package,
  Play,
  Sparkles,
  Gauge,
  Building2,
}

export function publicCollectionIcon(name: string | null | undefined): LucideIcon {
  return (name && MAP[name]) || BookOpen
}
