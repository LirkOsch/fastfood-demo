import Link from "next/link";
import { getAppSettings } from "@/lib/db";
import { listAdminOrders } from "@/lib/orders";
import {
  formatDateTime,
  formatRub,
  statusLabel,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "new", label: "Новые" },
  { id: "confirmed", label: "Подтверждённые" },
  { id: "completed", label: "Выполненные" },
  { id: "cancelled", label: "Отменённые" },
] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const query = await searchParams;
  const q = (query.q ?? "").slice(0, 80);
  const status = query.status && query.status !== "all" ? query.status : "";
  const [settings, { rows, counts }] = await Promise.all([
    getAppSettings(),
    listAdminOrders({ q, status }),
  ]);

  const hrefFor = (nextStatus: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (nextStatus !== "all") params.set("status", nextStatus);
    const search = params.toString();
    return `/admin/orders${search ? `?${search}` : ""}`;
  };

  const currentHref = hrefFor(status || "all");

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Заказы</h1>
          <p>
            {counts.all} всего · {counts.new} новых · показано до 200 последних
          </p>
        </div>
        <div className="admin-topbar__actions">
          <Link href={currentHref} className="btn btn--ghost btn--small">
            Обновить
          </Link>
          <Link href="/" className="btn btn--primary btn--small" target="_blank">
            Новый заказ на сайте
          </Link>
        </div>
      </header>

      <div className="admin-filters">
        <div className="filter-tabs" aria-label="Фильтр по статусу">
          {FILTERS.map((filter) => {
            const active = (status || "all") === filter.id;
            const count =
              filter.id === "all" ? counts.all : (counts[filter.id] ?? 0);
            return (
              <Link
                key={filter.id}
                href={hrefFor(filter.id)}
                aria-current={active ? "page" : undefined}
              >
                {filter.label}
                <span className="filter-tabs__count">{count}</span>
              </Link>
            );
          })}
        </div>
        <form className="search-form" action="/admin/orders" method="get">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Номер, имя, телефон или адрес"
            aria-label="Поиск заказов"
          />
          <button type="submit" className="btn btn--ghost btn--small">
            Найти
          </button>
        </form>
      </div>

      <section className="admin-panel">
        <div className="admin-panel__head">
          <h2>
            {q ? `Результаты по «${q}»` : "Список заказов"}
          </h2>
          {q ? (
            <Link href={status ? `/admin/orders?status=${status}` : "/admin/orders"} className="text-link small">
              Сбросить поиск
            </Link>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div className="admin-empty">
            {q || status
              ? "По этому фильтру заказов нет."
              : "Заказов пока нет. Оформите демо-заказ на сайте, чтобы проверить поток."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Заказ</th>
                  <th>Клиент</th>
                  <th>Сумма</th>
                  <th>Получение</th>
                  <th>Статус</th>
                  <th>Создан</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-testid="admin-order-row">
                    <td>
                      <Link href={`/admin/orders/${row.id}`}>{row.orderNo}</Link>
                      <span className="admin-table__sub">
                        {row.preferredDate
                          ? `к ${row.preferredDate}${row.preferredTime ? `, ${row.preferredTime}` : ""}`
                          : "как можно скорее"}
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
                      {row.deliveryMethod === "delivery" ? "Доставка" : "Самовывоз"}
                      {row.outOfTown ? (
                        <span className="admin-table__sub">за город</span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`status-pill status-pill--${row.status}`}>
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td>{formatDateTime(row.createdAt, settings.company.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="admin-panel__body" style={{ borderTop: "1px solid var(--line)" }}>
          <p className="tiny muted">
            Показаны последние 200 заказов. Для полной истории используйте поиск по номеру,
            имени, телефону или адресу.
          </p>
        </div>
      </section>
    </>
  );
}
