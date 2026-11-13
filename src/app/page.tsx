import { LandingPage } from "@/components/landing/LandingPage";
import { getAppSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getAppSettings();
  return <LandingPage settings={settings} />;
}
