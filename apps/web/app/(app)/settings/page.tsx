import { redirect } from "next/navigation"

/** Settings has no index — land on Profile. */
export default function SettingsIndex() {
  redirect("/settings/profile")
}
