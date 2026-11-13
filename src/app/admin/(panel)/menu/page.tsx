import { PricingForm } from "@/components/admin/PricingForm";
import { getAppSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const settings = await getAppSettings();
  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Меню и цены</h1>
          <p>Каталог фиксирован, меняются цены, доступность и правила расчёта.</p>
        </div>
      </header>
      <PricingForm initial={settings.pricing} />
    </>
  );
}
