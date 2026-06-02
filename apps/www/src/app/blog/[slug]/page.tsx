import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog-posts";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) {
    return { title: "Blog — Useroutr" };
  }

  return {
    title: `${post.title} — Useroutr`,
    description: post.excerpt,
    alternates: { canonical: post.canonicalPath },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) {
    notFound();
  }

  return (
    <PageShell>
      <PageEnter>
        <article className="border-t border-rule py-14 md:py-20">
          <div className="container-x">
            <div className="mx-auto max-w-[760px]">
              <Link
                href="/blog"
                className="group inline-flex items-center gap-1.5 text-[13px] text-ink-2 transition-colors hover:text-ink"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
                Back to blog
              </Link>

              <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-ink-3" style={{ fontFamily: "var(--font-mono)" }}>
                <span>{post.category}</span>
                <span>{post.publishedAt}</span>
                <span>{post.readTime}</span>
                <span>By {post.author}</span>
              </div>

              <h1
                className="mt-4 text-[38px] leading-[1.03] tracking-[-0.04em] text-ink md:text-[62px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                {post.title}
              </h1>

              <p className="mt-6 text-[18px] leading-relaxed text-ink-2">{post.excerpt}</p>

              <div className="mt-10 space-y-6 text-[16px] leading-relaxed text-ink-2 md:text-[18px]">
                {post.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </article>
      </PageEnter>
    </PageShell>
  );
}
