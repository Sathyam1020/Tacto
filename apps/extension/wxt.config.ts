import { defineConfig } from "wxt"

/**
 * Tacto capture extension (MV3, Chrome).
 *
 * Env (build-time, WXT_ prefix):
 *  - WXT_API_BASE  the Tacto API origin        (dev: http://localhost:4000)
 *  - WXT_APP_URL   the Tacto web app origin     (dev: http://localhost:3000)
 */
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Tacto — Capture",
    description:
      "Record a workflow once. Tacto turns it into a step-by-step guide.",
    permissions: ["activeTab", "tabs", "scripting", "storage"],
    host_permissions: ["<all_urls>"],
    action: { default_title: "Tacto" },
  },
})
