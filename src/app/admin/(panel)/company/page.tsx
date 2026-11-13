import { CompanyForm } from "@/components/admin/CompanyForm";
import { getAppSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminCompanyPage() {
  const settings = await getAppSettings();
  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Компания</h1>
          <p>Контакты, адрес, часы работы и акцентный цвет витрины.</p>
        </div>
      </header>
      <CompanyForm initial={settings.company} />
    </>
  );
}
