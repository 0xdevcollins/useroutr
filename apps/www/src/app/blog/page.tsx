import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";
import { BLOG_POSTS } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "Blog — Useroutr",
  description:
    "Insights on stablecoin payments, cross-chain settlement, compliance, and payments operations.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="Blog"
          title={
            <>
              Notes from the <span className="editorial-italic text-ink-2">payments edge</span>.
            </>
          }
          description="Technical explainers, operating playbooks, and strategic guidance for teams building global payment products."
        />

        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto max-w-[980px] divide-y divide-rule border-y border-rule">
              {BLOG_POSTS.map((post) => (
                <article key={post.slug} className="py-8 md:py-10">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-ink-3" style={{ fontFamily: "var(--font-mono)" }}>
                    <span>{post.category}</span>
                    <span>{post.publishedAt}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <h2
                    className="mt-3 text-[30px] leading-[1.08] tracking-[-0.03em] text-ink md:text-[40px]"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                  >
                    <Link href={`/blog/${post.slug}`} className="hover:text-ink-2 transition-colors">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-4 max-w-[720px] text-[16px] leading-relaxed text-ink-2">{post.excerpt}</p>
                  <div className="mt-6">
                    <Link href={`/blog/${post.slug}`} className="group inline-flex items-center gap-1 text-[14px] text-ink-2 transition-colors hover:text-ink">
                      <span className="link-underline">Read article</span>
                      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" strokeWidth={1.6} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
