import { CharacterForm } from "@/components/admin/CharacterForm";
import { getAppSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminCharactersPage() {
  const settings = await getAppSettings();
  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Персонаж</h1>
          <p>Маскот 3D-витрины: вид, имя, лицо и реплики.</p>
        </div>
      </header>
      <CharacterForm initial={settings.character} />
    </>
  );
}
