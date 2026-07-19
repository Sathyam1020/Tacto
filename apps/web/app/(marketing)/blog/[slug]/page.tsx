import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { BlogCover, PostRow, TagChip } from "@/components/marketing/blog-parts"
import { Cta } from "@/components/marketing/cta"
import { FaqAccordion } from "@/components/marketing/faq-accordion"
import { Prose } from "@/components/marketing/prose"
import { allPosts, formatDate, getPost } from "@/lib/marketing/blog"
import { breadcrumbJsonLd, faqPageJsonLd, jsonLd, pageMeta, SITE_URL } from "@/lib/marketing/seo"

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return pageMeta({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    type: "article",
    publishedTime: post.date,
    tags: post.tags,
  })
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const related = allPosts()
    .filter((p) => p.slug !== post.slug && p.tags.some((t) => post.tags.includes(t)))
    .slice(0, 2)

  const schema: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.date,
      author: { "@type": "Organization", name: post.author, url: SITE_URL },
      publisher: { "@type": "Organization", name: "Tacto", url: SITE_URL },
      mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${post.slug}` },
      keywords: post.tags.join(", "),
    },
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: post.title, path: `/blog/${post.slug}` },
    ]),
  ]
  if (post.faqs?.length) schema.push(faqPageJsonLd(post.faqs))

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />

      <article className="bg-white">
        <div className="mx-auto max-w-2xl px-5 pt-14 pb-8 sm:px-8 sm:pt-20">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--l-ink-subtle)] transition-colors hover:text-[var(--l-ink)]"
          >
            <ArrowLeft className="size-3.5" /> All posts
          </Link>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <TagChip key={t} tag={t} />
            ))}
          </div>
          <h1 className="mt-4 font-display text-[34px] leading-[1.12] font-semibold tracking-[-0.02em] text-balance text-[var(--l-ink)] sm:text-[44px]">
            {post.title}
          </h1>
          <p className="mt-4 font-accent text-[21px] leading-snug text-[var(--l-ink-subtle)]">{post.description}</p>
          <p className="mt-5 font-mono text-[12px] tracking-wide text-[var(--l-ink-tertiary)]">
            {post.author} · {formatDate(post.date)} · {post.readingMinutes} min read
          </p>
        </div>

        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <BlogCover post={post} className="h-56 rounded-3xl sm:h-72" />
        </div>

        <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
          <Prose>
            <post.Body />
          </Prose>
        </div>

        {post.faqs?.length ? (
          <div className="mx-auto max-w-2xl px-5 pb-12 sm:px-8">
            <h2 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.02em] text-[var(--l-ink)]">
              Frequently asked questions
            </h2>
            <div className="mt-6">
              <FaqAccordion items={post.faqs.map((f) => ({ q: f.q, a: f.a }))} />
            </div>
          </div>
        ) : null}
      </article>

      {related.length > 0 && (
        <section className="border-t border-[var(--l-hairline)] bg-[var(--l-canvas)]">
          <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
            <p className="font-mono text-[11px] tracking-widest text-cobalt uppercase">Keep reading</p>
            <div className="mt-6 flex flex-col gap-5">
              {related.map((p) => (
                <PostRow key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Cta />
    </>
  )
}
