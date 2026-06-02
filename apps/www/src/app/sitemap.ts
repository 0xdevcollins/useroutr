import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";

const baseUrl = "https://useroutr.com";

const useCases = ["marketplaces", "fintech", "ecommerce", "payouts"];

const productPages = [
  "hosted-checkout",
  "pay-by-link",
  "invoicing",
  "payouts",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const posts = getAllPosts();

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...productPages.map((slug) => ({
      url: `${baseUrl}/products/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
    {
      url: `${baseUrl}/use-cases`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/integrations`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...useCases.map((slug) => ({
      url: `${baseUrl}/use-cases/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
