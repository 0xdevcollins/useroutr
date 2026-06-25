import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Rss } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — Useroutr",
  description:
    "Notes on payment infrastructure, stablecoin rails, and the businesses building on them.",
  alternates: { canonical: "/blog" },
};

const categoryStyles: Record<string, string> = {
  Engineering: "bg-[#e8eafb] text-[#3b3da6]",
  Industry: "bg-[#e6f4ec] text-[#1f6c43]",
  "Case studies": "bg-[#fbeadc] text-[#a05418]",
  "Inside Useroutr": "bg-[#f0e3fb] text-[#6b21a8]",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="Blog"
          title={
            <>
              What we&rsquo;re{" "}
              <span className="editorial-italic text-ink-2">thinking about</span>
              .
            </>
          }
          description="Notes on payment infrastructure, stablecoin rails, and the businesses building on them. Long-form pieces on the architecture choices behind Useroutr, what we learn from customer integrations, and where stablecoin payments are actually heading. Mostly written by people on the engineering team."
        >
          <Link
            href="/blog/rss.xml"
            className="inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 text-[12px] text-ink-2 transition hover:border-ink hover:text-ink"
          >
            <Rss className="size-3.5" strokeWidth={1.6} />
            RSS feed
          </Link>
        </PageMast>

        <section className="border-t border-rule py-16 md:py-20">
          <div className="container-x">
            <div className="mx-auto max-w-[1080px]">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group flex flex-col gap-4 rounded-3xl border border-rule bg-bg-card p-6 transition hover:border-ink/30 md:p-7"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] uppercase tracking-[0.14em] ${categoryStyles[post.category] ?? "bg-[#f0f0f0] text-ink-3"}`}
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {post.category}
                      </span>
                      <span
                        className="text-[11px] text-ink-4"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {post.readTime}
                      </span>
                    </div>

                    <h2
                      className="text-[18px] leading-[1.2] tracking-[-0.02em] text-ink md:text-[20px]"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                    >
                      {post.title}
                    </h2>

                    <p className="line-clamp-2 flex-1 text-[14px] leading-relaxed text-ink-2">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between border-t border-rule pt-4">
                      <div>
                        <div className="text-[13px] text-ink">{post.author}</div>
                        <div
                          className="text-[11px] text-ink-4"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {new Date(post.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <ArrowRight
                        className="size-4 text-ink-4 transition group-hover:translate-x-0.5 group-hover:text-ink"
                        strokeWidth={1.6}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
