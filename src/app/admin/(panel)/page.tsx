import Link from "next/link";
import { getCurrentAdmin } from "@/lib/auth";
import { getAppSettings } from "@/lib/db";
import { listAdminOrders } from "@/lib/orders";
import {
  formatDateTime,
  formatRub,
  statusLabel,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [admin, settings, { rows, counts }] = await Promise.all([
    getCurrentAdmin(),
    getAppSettings(),
    listAdminOrders({}),
  ]);

  const recent = rows.slice(0, 7);
  const revenue = rows
    .filter((row) => row.status === "completed" || row.status === "confirmed")
    .reduce((sum, row) => sum + (row.finalTotal ?? row.totalKnown), 0);
  const today = new Intl.DateTimeFormat("ru-RU", {
    timeZone: settings.company.timezone,
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date());

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Обзор</h1>
          <p>
            {today} · {settings.company.name}, {settings.company.city}
          </p>
        </div>
        <div className="admin-topbar__actions">
          <Link href="/admin/orders" className="btn btn--primary btn--small">
            Все заказы
          </Link>
          <Link href="/admin/menu" className="btn btn--ghost btn--small">
            Изменить цены
          </Link>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <span>Новые</span>
          <strong>{counts.new ?? 0}</strong>
          <small>ждут подтверждения</small>
        </div>
        <div className="stat-card">
          <span>Подтверждены</span>
          <strong>{counts.confirmed ?? 0}</strong>
          <small>в работе</small>
        </div>
        <div className="stat-card">
          <span>Выполнены</span>
          <strong>{counts.completed ?? 0}</strong>
          <small>завершённые заказы</small>
        </div>
        <div className="stat-card">
          <span>Сумма в работе</span>
          <strong>{formatRub(revenue)}</strong>
          <small>подтверждено и выполнено</small>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-panel">
          <div className="admin-panel__head">
            <h2>Последние заказы</h2>
            <Link href="/admin/orders" className="text-link small">
              Открыть список
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="admin-empty">
              Заказов пока нет. Откройте сайт и оформите первый демо-заказ.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Заказ</th>
                    <th>Клиент</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/admin/orders/${row.id}`}>{row.orderNo}</Link>
                        <span className="admin-table__sub">
                          {row.deliveryMethod === "delivery"
                            ? row.outOfTown
                              ? "доставка за город"
                              : "доставка"
                            : "самовывоз"}
                        </span>
                      </td>
                      <td>
                        {row.customerName}
                        <span className="admin-table__sub">{row.phone}</span>
                      </td>
                      <td>
                        {formatRub(row.finalTotal ?? row.totalKnown)}
                        {row.hasQuote ? (
                          <span className="admin-table__sub">есть «по запросу»</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`status-pill status-pill--${row.status}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td>
                        {formatDateTime(row.createdAt, settings.company.timezone)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2>Привет, {admin?.name ?? "владелец"}</h2>
            </div>
            <div className="admin-panel__body" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <p className="small muted">
                Это демо-кабинет. Все изменения сохраняются в локальной базе PGlite и сразу
                видны на клиентских страницах.
              </p>
              <Link href="/admin/orders" className="btn btn--ghost btn--small btn--block">
                Проверить новые заказы
              </Link>
              <Link href="/admin/game" className="btn btn--ghost btn--small btn--block">
                Настроить бонус за игру
              </Link>
              <Link href="/" className="btn btn--ghost btn--small btn--block" target="_blank">
                Открыть витрину
              </Link>
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2>Сейчас в настройках</h2>
            </div>
            <div className="admin-panel__body">
              <div className="admin-lines">
                <div className="admin-line">
                  <span>Минимум заказа</span>
                  <span>{formatRub(settings.pricing.minOrder)}</span>
                </div>
                <div className="admin-line">
                  <span>Доставка по городу</span>
                  <span>{formatRub(settings.pricing.deliveryFee)}</span>
                </div>
                <div className="admin-line">
                  <span>За город</span>
                  <span>{formatRub(settings.pricing.outOfTownFee)}</span>
                </div>
                <div className="admin-line">
                  <span>Игра</span>
                  <span>
                    {settings.game.mode === "off"
                      ? "выключена"
                      : settings.game.mode === "play"
                        ? "без бонуса"
                        : `бонус ${formatRub(settings.game.bonusAmount)}`}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
