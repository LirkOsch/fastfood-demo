import { AccessForms } from "@/components/admin/AccessForms";
import { listActiveSessions, requireAdminPage } from "@/lib/auth";
import { getAppSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  const admin = await requireAdminPage();
  const [settings, sessions] = await Promise.all([
    getAppSettings(),
    listActiveSessions(admin.id),
  ]);

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Доступ</h1>
          <p>Пароль владельца и активные сессии кабинета.</p>
        </div>
      </header>
      <AccessForms
        admin={{ name: admin.name, email: admin.email }}
        sessions={sessions.map((session) => ({
          id: session.id,
          userAgent: session.userAgent,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        }))}
        currentSessionId={admin.sessionId}
        timezone={settings.company.timezone}
      />
    </>
  );
}
