import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { getAllPosts, getPost } from "@/lib/blog";

const categoryStyles: Record<string, string> = {
  Engineering: "bg-[#e8eafb] text-[#3b3da6]",
  Industry: "bg-[#e6f4ec] text-[#1f6c43]",
  "Case studies": "bg-[#fbeadc] text-[#a05418]",
  "Inside Useroutr": "bg-[#f0e3fb] text-[#6b21a8]",
};

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Blog — Useroutr" };
  return {
    title: `${post.title} — Useroutr`,
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  // Dynamically import the compiled MDX file
  let MDXContent: React.ComponentType;
  try {
    const mod = await import(`../../../../content/blog/${slug}.mdx`);
    MDXContent = mod.default;
  } catch {
    notFound();
  }

  return (
    <PageShell>
      <PageEnter>
        {/* Breadcrumb ribbon */}
        <div className="border-b border-rule bg-bg-card">
          <div className="container-x flex h-10 items-center justify-between text-[12px]">
            <span style={{ fontFamily: "var(--font-mono)" }}>
              ↘ blog / {post.category.toLowerCase()}
            </span>
            <Link
              href="/blog"
              className="group inline-flex items-center gap-1 text-ink-2 transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-3 transition group-hover:-translate-x-0.5" />
              All posts
            </Link>
          </div>
        </div>

        {/* Article header */}
        <header className="border-b border-rule py-14 md:py-20">
          <div className="container-x">
            <div className="mx-auto max-w-[760px]">
              <div className="flex items-center gap-3">
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
                  {post.readTime} read
                </span>
              </div>

              <h1
                className="mt-5 text-[36px] leading-[1.05] tracking-[-0.04em] text-ink md:text-[56px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                {post.title}
              </h1>

              <p className="mt-5 text-[17px] leading-relaxed text-ink-2 md:text-[18px]">
                {post.excerpt}
              </p>

              <div
                className="mt-8 flex items-center gap-4 text-[13px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span className="text-ink">{post.author}</span>
                <span className="text-ink-4">·</span>
                <span className="text-ink-3">
                  {new Date(post.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Article body */}
        <article className="py-14 md:py-20">
          <div className="container-x">
            <div className="prose mx-auto max-w-[760px]">
              <MDXContent />
            </div>
          </div>
        </article>

        {/* Footer nav */}
        <div className="border-t border-rule py-10">
          <div className="container-x">
            <div className="mx-auto max-w-[760px]">
              <Link
                href="/blog"
                className="group inline-flex items-center gap-1.5 text-[14px] text-ink-2 transition-colors hover:text-ink"
              >
                <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
                Back to all posts
              </Link>
            </div>
          </div>
        </div>
      </PageEnter>
    </PageShell>
  );
}
