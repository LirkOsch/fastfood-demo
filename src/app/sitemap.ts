import type { MetadataRoute } from "next";

const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date("2026-11-12T00:00:00+04:00");
  return [
    { url: `${appUrl}/`, lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/contacts`, lastModified: updated, changeFrequency: "monthly", priority: 0.6 },
    { url: `${appUrl}/privacy`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/terms`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/licenses`, lastModified: updated, changeFrequency: "yearly", priority: 0.2 },
  ];
}
