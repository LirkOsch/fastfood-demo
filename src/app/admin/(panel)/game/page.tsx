import { GameForm } from "@/components/admin/GameForm";
import { getAppSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminGamePage() {
  const settings = await getAppSettings();
  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Игра и бонусы</h1>
          <p>Необязательная игра после заказа и ручная активация кодов.</p>
        </div>
      </header>
      <GameForm initial={settings.game} />
    </>
  );
}
