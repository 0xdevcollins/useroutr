import { MetadataRoute } from "next";

<<<<<<< Updated upstream
const baseUrl = "https://useroutr.com";

const staticRoutes = ["/pricing", "/terms", "/privacy"];
=======
const baseUrl = "https://useroutr.io";

const useCases = ["marketplaces", "fintech", "ecommerce", "payouts"];
>>>>>>> Stashed changes

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
<<<<<<< Updated upstream
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: route === "/pricing" ? 0.9 : 0.5,
=======
    {
      url: `${baseUrl}/use-cases`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...useCases.map((slug) => ({
      url: `${baseUrl}/use-cases/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
>>>>>>> Stashed changes
    })),
  ];
}
