import { BLOG_POSTS } from "@/lib/blog-posts";

export async function GET() {
  const siteUrl = "https://useroutr.com";
  const latest = BLOG_POSTS.slice(0, 10);

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Useroutr Updates</title>
    <description>Latest updates from Useroutr.</description>
    <link>${siteUrl}/changelog</link>
    ${latest
      .map(
        (post) => `<item>
      <title>${post.title}</title>
      <link>${siteUrl}${post.canonicalPath}</link>
      <guid>${siteUrl}${post.canonicalPath}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <description><![CDATA[${post.excerpt}]]></description>
    </item>`,
      )
      .join("\n")}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
