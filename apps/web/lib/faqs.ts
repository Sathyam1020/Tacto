import { useMutation } from "@tanstack/react-query"

import type { Faq } from "@workspace/contracts/guide"

import { api } from "@/lib/api"

/**
 * Generate AI FAQ suggestions for a guide. Stateless — the returned FAQs are
 * staged into the editor's draft (which autosaves), never persisted server-side
 * on their own. `count` = slots to fill (bulk = remaining; regenerate = 1);
 * `avoid` = existing questions the model must not duplicate.
 */
export function useGenerateFaqs(guideId: string) {
  return useMutation({
    mutationFn: async (input: { count: number; avoid: string[] }) => {
      const { data } = await api.post<{ faqs: Faq[] }>(
        `/guides/${guideId}/faqs/generate`,
        input
      )
      return data.faqs
    },
  })
}
