import { MetadataRoute } from "next";

const baseUrl = "https://useroutr.com";

const staticRoutes = ["/pricing", "/terms", "/privacy"];

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
      priority: route === "/pricing" ? 0.9 : 0.5,
    })),
  ];
}
