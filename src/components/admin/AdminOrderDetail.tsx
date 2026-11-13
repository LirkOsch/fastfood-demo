"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PricedLine } from "@/lib/pricing";
import type { StoredTotals } from "@/lib/db/schema";
import {
  deliveryLabel,
  formatDateLong,
  formatDateTime,
  formatDateTimeLocal,
  formatRub,
  statusLabel,
} from "@/lib/format";

export interface AdminOrderView {
  id: string;
  orderNo: string;
  publicToken: string;
  status: string;
  customerName: string;
  phone: string;
  deliveryMethod: string;
  address: string | null;
  outOfTown: boolean;
  preferredDate: string | null;
  preferredTime: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  finalTotal: number | null;
  agreedAtLocal: string;
  adminNote: string | null;
  items: PricedLine[];
  totals: StoredTotals;
  photos: Array<{ id: string; width: number; height: number }>;
  events: Array<{ id: string; type: string; createdAt: string; payload: Record<string, unknown> }>;
  bonus: {
    code: string;
    amount: number;
    minOrder: number;
    status: string;
    expiresAt: string;
  } | null;
  pricingCapturedAt: string;
  timezone: string;
}

const STATUS_OPTIONS = ["new", "confirmed", "completed", "cancelled"] as const;

const ALLOWED: Record<string, string[]> = {
  new: ["new", "confirmed", "cancelled"],
  confirmed: ["confirmed", "completed", "cancelled"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

const EVENT_LABELS: Record<string, string> = {
  created: "Заказ принят",
  status_changed: "Статус изменён",
  terms_changed: "Изменены цена или время",
  note_changed: "Внутренняя заметка обновлена",
  bonus_issued: "Бонус выдан",
  bonus_redeemed: "Бонус активирован",
};

export function AdminOrderDetail({ order }: { order: AdminOrderView }) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status);
  const [finalTotal, setFinalTotal] = useState(
    order.finalTotal !== null ? String(order.finalTotal) : "",
  );
  const [agreedAtLocal, setAgreedAtLocal] = useState(order.agreedAtLocal);
  const [adminNote, setAdminNote] = useState(order.adminNote ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteAck, setDeleteAck] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [bonusPending, setBonusPending] = useState(false);

  const allowed = ALLOWED[status] ?? [];
  const nowLabel = useMemo(
    () => formatDateTimeLocal(new Date().toISOString(), order.timezone),
    [order.timezone],
  );

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError("");
    setMessage("");
    setFieldErrors({});

    const total = finalTotal.trim() === "" ? null : Number(finalTotal);
    if (total !== null && (!Number.isFinite(total) || total < 0 || !Number.isInteger(total))) {
      setFieldErrors({ finalTotal: "Введите целую сумму в рублях." });
      return;
    }
    if (status === "confirmed") {
      if (!total || total <= 0) {
        setFieldErrors({ finalTotal: "Для подтверждения укажите итоговую цену." });
        return;
      }
      if (!agreedAtLocal) {
        setFieldErrors({ agreedAtLocal: "Укажите согласованное время." });
        return;
      }
    }

    setPending(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          status,
          finalTotal: total,
          agreedAtLocal,
          adminNote,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; fieldErrors?: Record<string, string> }
        | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "Не удалось сохранить заказ.");
        setFieldErrors(data?.fieldErrors ?? {});
        return;
      }
      setMessage("Сохранено. Клиентская страница покажет изменения после обновления.");
      router.refresh();
    } catch {
      setError("Сеть недоступна. Изменения не сохранены.");
    } finally {
      setPending(false);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/order/${order.publicToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать ссылку — откройте её кнопкой рядом.");
    }
  };

  const redeem = async () => {
    if (!order.bonus || bonusPending) return;
    setBonusPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/bonus/${order.bonus.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status: "redeemed" }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "Не удалось активировать бонус.");
        return;
      }
      setMessage("Бонус отмечен использованным.");
      router.refresh();
    } catch {
      setError("Сеть недоступна.");
    } finally {
      setBonusPending(false);
    }
  };

  const remove = async () => {
    if (deletePending) return;
    setDeletePending(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          confirm: deleteConfirm,
          acknowledgedPhotos: order.photos.length > 0 ? deleteAck : false,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; fieldErrors?: Record<string, string> }
        | null;
      if (!response.ok || !data?.ok) {
        setDeleteError(
          data?.fieldErrors?.confirm ??
            data?.fieldErrors?.acknowledgedPhotos ??
            data?.error ??
            "Не удалось удалить заказ.",
        );
        return;
      }
      router.replace("/admin/orders");
      router.refresh();
    } catch {
      setDeleteError("Сеть недоступна.");
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <>
      <header className="admin-topbar">
        <div>
          <Link href="/admin/orders" className="text-link small">
            ← Все заказы
          </Link>
          <h1 style={{ marginTop: 6 }}>{order.orderNo}</h1>
          <p>
            Создан {formatDateTime(order.createdAt, order.timezone)} ·{" "}
            {deliveryLabel(order.deliveryMethod)} ·{" "}
            <span className={`status-pill status-pill--${order.status}`}>
              {statusLabel(order.status)}
            </span>
          </p>
        </div>
        <div className="admin-topbar__actions">
          <Link
            href={`/order/${order.publicToken}`}
            target="_blank"
            className="btn btn--ghost btn--small"
          >
            Страница клиента
          </Link>
          <button type="button" className="btn btn--soft btn--small" onClick={() => void copyLink()}>
            {copied ? "Ссылка скопирована" : "Копировать ссылку"}
          </button>
        </div>
      </header>

      {message ? (
        <div className="form-success" style={{ marginBottom: 14 }} role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="form-alert" style={{ marginBottom: 14 }} role="alert" data-testid="admin-error">
          {error}
        </div>
      ) : null}

      <div className="admin-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <form className="admin-panel" onSubmit={save} data-testid="admin-order-form">
            <div className="admin-panel__head">
              <h2>Управление заказом</h2>
              <span className="tiny muted">Изменения видны на странице клиента</span>
            </div>
            <div className="admin-panel__body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <span className="field__label">Статус</span>
                <div className="radio-cards">
                  {STATUS_OPTIONS.map((option) => {
                    const disabled = !allowed.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        className="radio-card"
                        aria-pressed={status === option}
                        onClick={() => {
                          if (disabled) return;
                          setStatus(option);
                          setMessage("");
                        }}
                        disabled={disabled}
                        style={disabled ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                      >
                        <strong>{statusLabel(option)}</strong>
                        <span>
                          {disabled
                            ? "Недоступно из текущего статуса"
                            : option === "confirmed"
                              ? "Нужны цена и время"
                              : option === "cancelled"
                                ? "Отменить заказ"
                                : option === "completed"
                                  ? "Заказ передан"
                                  : "Вернуть в работу"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="finalTotal">
                    Итоговая цена, ₽
                  </label>
                  <input
                    id="finalTotal"
                    className="input"
                    inputMode="numeric"
                    value={finalTotal}
                    onChange={(event) => setFinalTotal(event.target.value.replace(/[^\d]/g, ""))}
                    placeholder={String(order.totals.totalKnown)}
                    aria-invalid={Boolean(fieldErrors.finalTotal)}
                    data-testid="final-total"
                  />
                  <p className="field__hint">
                    Известная сумма: {formatRub(order.totals.totalKnown)}
                    {order.totals.hasQuote ? " + «по запросу»" : ""}
                  </p>
                  {fieldErrors.finalTotal ? (
                    <p className="field__error">{fieldErrors.finalTotal}</p>
                  ) : null}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="agreedAtLocal">
                    Согласованное время
                  </label>
                  <input
                    id="agreedAtLocal"
                    type="datetime-local"
                    className="input"
                    value={agreedAtLocal}
                    onChange={(event) => setAgreedAtLocal(event.target.value)}
                    aria-invalid={Boolean(fieldErrors.agreedAtLocal)}
                    data-testid="agreed-at"
                  />
                  <p className="field__hint">
                    Часовой пояс: {order.timezone}. Сейчас: {nowLabel}
                  </p>
                  {fieldErrors.agreedAtLocal ? (
                    <p className="field__error">{fieldErrors.agreedAtLocal}</p>
                  ) : null}
                </div>
                <div className="field field--full">
                  <label className="field__label" htmlFor="adminNote">
                    Внутренняя заметка
                  </label>
                  <textarea
                    id="adminNote"
                    className="textarea"
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                    maxLength={2000}
                    placeholder="Не видна клиенту: состав, звонки, нюансы"
                    data-testid="admin-note"
                  />
                </div>
              </div>

              <div className="admin-form__foot" style={{ position: "static" }}>
                <span className="small">
                  Для «Подтверждён» обязательны итоговая цена и время.
                </span>
                <button type="submit" className="btn btn--primary" disabled={pending} data-testid="save-order">
                  {pending ? <span className="spinner" aria-hidden="true" /> : null}
                  {pending ? "Сохраняем…" : "Сохранить"}
                </button>
              </div>
            </div>
          </form>

          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2>Состав и суммы</h2>
              <span className="tiny muted">
                Снимок цен от {formatDateTime(order.pricingCapturedAt, order.timezone)}
              </span>
            </div>
            <div className="admin-panel__body">
              {order.items.map((line) => (
                <div className="admin-line" key={line.key}>
                  <span>
                    {line.name} × {line.qty}
                    <br />
                    <span className="tiny muted">
                      {line.variantLabel}
                      {line.optionLabels.length > 0 ? ` · ${line.optionLabels.join(", ")}` : ""}
                      {line.quote ? " · по запросу" : ""}
                    </span>
                    {line.customDescription ? (
                      <span className="admin-note" style={{ display: "block", marginTop: 5 }}>
                        {line.customDescription}
                      </span>
                    ) : null}
                  </span>
                  <span>{line.lineTotal !== null ? formatRub(line.lineTotal) : "По запросу"}</span>
                </div>
              ))}
              <div className="order-totals">
                <div className="summary-row">
                  <span>Известные блюда</span>
                  <strong>{formatRub(order.totals.knownFood)}</strong>
                </div>
                {order.totals.minUplift > 0 ? (
                  <div className="summary-row">
                    <span>Доплата до минимума</span>
                    <strong>{formatRub(order.totals.minUplift)}</strong>
                  </div>
                ) : null}
                {order.totals.deliveryFee > 0 ? (
                  <div className="summary-row">
                    <span>Доставка</span>
                    <strong>{formatRub(order.totals.deliveryFee)}</strong>
                  </div>
                ) : null}
                {order.totals.outOfTownFee > 0 ? (
                  <div className="summary-row">
                    <span>За город</span>
                    <strong>{formatRub(order.totals.outOfTownFee)}</strong>
                  </div>
                ) : null}
                <div className="summary-total">
                  <span>{order.finalTotal ? "Согласованный итог" : "Известная сумма"}</span>
                  <strong>{formatRub(order.finalTotal ?? order.totals.totalKnown)}</strong>
                </div>
              </div>
            </div>
          </section>

          {order.photos.length > 0 ? (
            <section className="admin-panel">
              <div className="admin-panel__head">
                <h2>Фото от клиента</h2>
                <span className="tiny muted">Удаляются вместе с заказом</span>
              </div>
              <div className="admin-panel__body">
                <div className="admin-photo-grid">
                  {order.photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={`/api/admin/orders/${order.id}/photos/${photo.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/admin/orders/${order.id}/photos/${photo.id}`}
                        alt="Фото к заказу"
                        loading="lazy"
                        width={photo.width}
                        height={photo.height}
                      />
                    </a>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2>История</h2>
            </div>
            <div className="admin-panel__body">
              <div className="timeline">
                {[...order.events].reverse().map((event) => (
                  <div className="timeline__item" key={event.id}>
                    <span className="timeline__dot timeline__dot--done" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    </span>
                    <div className="timeline__body">
                      <strong>{EVENT_LABELS[event.type] ?? event.type}</strong>
                      <span>
                        {formatDateTime(event.createdAt, order.timezone)}
                        {event.type === "status_changed" && event.payload.to
                          ? ` · ${statusLabel(String(event.payload.to))}`
                          : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2>Клиент</h2>
            </div>
            <div className="admin-panel__body">
              <div className="info-list">
                <div className="info-row">
                  <span>
                    <small>Имя</small>
                    <strong>{order.customerName}</strong>
                  </span>
                </div>
                <div className="info-row">
                  <span>
                    <small>Телефон</small>
                    <a href={`tel:${order.phone.replace(/[^+\d]/g, "")}`}>{order.phone}</a>
                  </span>
                </div>
                <div className="info-row">
                  <span>
                    <small>{deliveryLabel(order.deliveryMethod)}</small>
                    {order.deliveryMethod === "delivery"
                      ? order.address ?? "адрес не указан"
                      : "самовывоз"}
                    {order.outOfTown ? " · за город" : ""}
                  </span>
                </div>
                {order.preferredDate ? (
                  <div className="info-row">
                    <span>
                      <small>Пожелание по времени</small>
                      {formatDateLong(order.preferredDate)}
                      {order.preferredTime ? `, ${order.preferredTime}` : ""}
                    </span>
                  </div>
                ) : null}
              </div>
              {order.comment ? (
                <div className="admin-note" style={{ marginTop: 10 }}>
                  <strong>Комментарий клиента:</strong> {order.comment}
                </div>
              ) : null}
              {order.adminNote ? (
                <div className="admin-note" style={{ marginTop: 10 }}>
                  <strong>Ваша заметка:</strong> {order.adminNote}
                </div>
              ) : null}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2>Бонус</h2>
            </div>
            <div className="admin-panel__body">
              {order.bonus ? (
                <>
                  <div className="bonus-code" style={{ color: "var(--ink)", background: "var(--surface-2)", borderColor: "var(--line-strong)" }}>
                    <span>{order.bonus.code}</span>
                    <small>{formatRub(order.bonus.amount)}</small>
                  </div>
                  <div className="admin-lines" style={{ marginTop: 8 }}>
                    <div className="admin-line">
                      <span>Статус</span>
                      <span>{order.bonus.status === "redeemed" ? "использован" : "выдан"}</span>
                    </div>
                    <div className="admin-line">
                      <span>Минимум</span>
                      <span>{formatRub(order.bonus.minOrder)}</span>
                    </div>
                    <div className="admin-line">
                      <span>Действует до</span>
                      <span>{formatDateTime(order.bonus.expiresAt, order.timezone)}</span>
                    </div>
                  </div>
                  {order.bonus.status === "issued" ? (
                    <button
                      type="button"
                      className="btn btn--soft btn--small btn--block"
                      style={{ marginTop: 10 }}
                      onClick={() => void redeem()}
                      disabled={bonusPending}
                      data-testid="redeem-bonus"
                    >
                      {bonusPending ? "Активируем…" : "Отметить использованным"}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="small muted">
                  Бонуса пока нет. Он появится, если клиент сыграет в игру при включённом
                  режиме «Бонус».
                </p>
              )}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2>Приватная ссылка</h2>
            </div>
            <div className="admin-panel__body">
              <div className="copy-row">
                <input
                  className="input"
                  readOnly
                  value={`/order/${order.publicToken}`}
                  onFocus={(event) => event.target.select()}
                  aria-label="Приватная ссылка клиента"
                />
                <button type="button" className="btn btn--ghost btn--small" onClick={() => void copyLink()}>
                  {copied ? "Готово" : "Копировать"}
                </button>
              </div>
              <p className="field__hint" style={{ marginTop: 7 }}>
                Ссылка непредсказуемая. Не публикуйте её в открытых каналах.
              </p>
            </div>
          </section>

          <section className="admin-panel admin-danger">
            <div className="admin-panel__head">
              <h2>Удаление</h2>
            </div>
            <div className="admin-panel__body">
              {!deleteOpen ? (
                <button
                  type="button"
                  className="btn btn--danger btn--small btn--block"
                  onClick={() => setDeleteOpen(true)}
                >
                  Удалить заказ
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p className="small">
                    Удаление необратимо и удалит фото, историю и бонус. Введите номер{" "}
                    <strong>{order.orderNo}</strong>.
                  </p>
                  <input
                    className="input"
                    value={deleteConfirm}
                    onChange={(event) => setDeleteConfirm(event.target.value)}
                    placeholder={order.orderNo}
                    aria-label="Номер заказа для подтверждения"
                    data-testid="delete-confirm"
                  />
                  {order.photos.length > 0 ? (
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={deleteAck}
                        onChange={(event) => setDeleteAck(event.target.checked)}
                      />
                      <span>Подтверждаю удаление {order.photos.length} фото.</span>
                    </label>
                  ) : null}
                  {deleteError ? <p className="field__error">{deleteError}</p> : null}
                  <div className="hero__actions">
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={() => void remove()}
                      disabled={deletePending}
                      data-testid="delete-order"
                    >
                      {deletePending ? "Удаляем…" : "Удалить навсегда"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => {
                        setDeleteOpen(false);
                        setDeleteError("");
                        setDeleteConfirm("");
                        setDeleteAck(false);
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
