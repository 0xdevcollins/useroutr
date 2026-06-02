import { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { PRODUCT_PAGES } from "@/lib/product-pages";

const baseUrl = "https://useroutr.com";

const useCases = ["marketplaces", "fintech", "ecommerce", "payouts"];
const customerStories = ["helix-labs", "brushwood", "pelago"];
const pressReleases = [
  "series-a",
  "pay-by-link",
  "moneygram-partnership",
  "exit-stealth",
];
const staticRoutes = [
  "/about",
  "/pricing",
  "/products",
  "/integrations",
  "/contact",
  "/use-cases",
  "/customers",
  "/press",
  "/blog",
  "/changelog",
  "/terms",
  "/privacy",
  "/cookies",
  "/dpa",
  "/sla",
  "/security",
  "/security/responsible-disclosure",
  "/security/researchers",
  "/compliance",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: route === "/pricing" || route === "/products" ? 0.9 : 0.7,
    })),
    ...PRODUCT_PAGES.map((product) => ({
      url: `${baseUrl}/products/${product.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...useCases.map((slug) => ({
      url: `${baseUrl}/use-cases/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...customerStories.map((slug) => ({
      url: `${baseUrl}/customers/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    ...pressReleases.map((slug) => ({
      url: `${baseUrl}/press/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...BLOG_POSTS.map((post) => ({
      url: `${baseUrl}${post.canonicalPath}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];
}
