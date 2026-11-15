import { LandingPage } from "@/components/landing/LandingPage";
import { getAppSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export default async function HomePage() {
  const settings = await getAppSettings();
  const { company } = settings;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: company.name,
    description: company.description,
    url: appUrl,
    hasMenu: `${appUrl}/#menu`,
    servesCuisine: ["Бургеры", "Шаурма", "Пицца"],
    priceRange: "₽₽",
    ...(company.phone ? { telephone: company.phone } : {}),
    ...(company.email ? { email: company.email } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: company.address,
      addressLocality: company.city,
    },
  }).replace(/</g, "\\u003c");

  return (
    <>
      <LandingPage settings={settings} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
    </>
  );
}
