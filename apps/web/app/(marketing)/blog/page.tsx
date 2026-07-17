import type { Metadata } from "next"
import Link from "next/link"

import { cn } from "@workspace/ui/lib/utils"

import { FeaturedCard, PostRow } from "@/components/marketing/blog-parts"
import { PageHero } from "@/components/marketing/page-hero"
import { StaggerReveal, Item, Reveal } from "@/components/marketing/motion"
import { allPosts, allTags, featuredPosts } from "@/lib/marketing/blog"
import { jsonLd, pageMeta, SITE_URL } from "@/lib/marketing/seo"

export const metadata: Metadata = pageMeta({
  title: "Blog",
  description:
    "Playbooks for smarter onboarding, SOPs, support, and product demos — from the team building Tacto. Practical, tool-agnostic guides on documenting how work gets done.",
  path: "/blog",
})

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Tacto Blog",
  url: `${SITE_URL}/blog`,
  description: "Playbooks for smarter onboarding, SOPs, support, and product demos.",
  blogPost: allPosts().map((p) => ({
    "@type": "BlogPosting",
    headline: p.title,
    description: p.description,
    datePublished: p.date,
    url: `${SITE_URL}/blog/${p.slug}`,
    author: { "@type": "Organization", name: p.author },
  })),
}

export default async function BlogIndex({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams
  const tags = allTags()
  const activeTag = tag && tags.includes(tag) ? tag : null
  const posts = activeTag ? allPosts().filter((p) => p.tags.includes(activeTag)) : allPosts()
  const featured = featuredPosts().slice(0, 3)
  const showFeatured = !activeTag && featured.length > 0

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(SCHEMA) }} />
      <PageHero
        eyebrow="Blog"
        title="Documentation, made simple."
        subtitle="Playbooks for smarter onboarding, SOPs, and support."
      />

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          {/* Tag filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/blog"
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                !activeTag
                  ? "border-primary bg-primary text-white"
                  : "border-[var(--l-hairline)] bg-white text-[var(--l-ink-subtle)] hover:text-[var(--l-ink)]"
              )}
            >
              All
            </Link>
            {tags.map((t) => (
              <Link
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  activeTag === t
                    ? "border-primary bg-primary text-white"
                    : "border-[var(--l-hairline)] bg-white text-[var(--l-ink-subtle)] hover:text-[var(--l-ink)]"
                )}
              >
                {t}
              </Link>
            ))}
          </div>

          {/* Featured row (only on the unfiltered index) */}
          {showFeatured && (
            <div className="mt-12">
              <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">Featured</p>
              <StaggerReveal className="mt-5 grid gap-5 md:grid-cols-3">
                {featured.map((p) => (
                  <Item key={p.slug}>
                    <FeaturedCard post={p} />
                  </Item>
                ))}
              </StaggerReveal>
            </div>
          )}

          {/* All / filtered posts */}
          <div className="mt-14">
            <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">
              {activeTag ? activeTag : "Latest"}
            </p>
            <div className="mt-5 flex flex-col gap-5">
              {posts.map((p) => (
                <Reveal key={p.slug}>
                  <PostRow post={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
