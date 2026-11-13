"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { PublicBonus, PublicOrder } from "@/lib/orders";
import type { CompanySettings } from "@/lib/settings";
import {
  deliveryLabel,
  formatDateLong,
  formatDateTime,
  formatRub,
  statusLabel,
} from "@/lib/format";

const TrayGame = dynamic(() => import("@/components/game/TrayGame"), {
  ssr: false,
  loading: () => (
    <div className="game-canvas-wrap" style={{ display: "grid", placeItems: "center" }}>
      <span className="spinner" aria-hidden="true" />
    </div>
  ),
});

interface OrderViewProps {
  initial: PublicOrder;
  token: string;
  company: CompanySettings;
  created: boolean;
}

type GameStage = "play" | "result" | "error";

export function OrderView({ initial, token, company, created }: OrderViewProps) {
  const [order, setOrder] = useState<PublicOrder>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showCreated, setShowCreated] = useState(created);
  const [gameOpen, setGameOpen] = useState(false);
  const [gameStage, setGameStage] = useState<GameStage>("play");
  const [gameBusy, setGameBusy] = useState(false);
  const [gameError, setGameError] = useState("");
  const [gameSession, setGameSession] = useState(0);
  const closeGameRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const response = await fetch(`/api/orders/${token}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) {
          setRefreshError("Не удалось обновить статус. Попробуйте ещё раз.");
          return;
        }
        const data = (await response.json()) as PublicOrder;
        setOrder(data);
        setRefreshError("");
      } catch {
        setRefreshError("Нет связи с сервером. Статус мог обновиться позже.");
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!gameOpen) return;
    const previous = document.body.classList.contains("is-locked");
    document.body.classList.add("is-locked");
    closeGameRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !gameBusy) setGameOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (!previous) document.body.classList.remove("is-locked");
    };
  }, [gameOpen, gameBusy]);

  const copyLink = async () => {
    const url = `${window.location.origin}/order/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const input = document.getElementById("private-link") as HTMLInputElement | null;
      input?.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } catch {
        setRefreshError("Скопируйте ссылку вручную из поля выше.");
      }
    }
  };

  const openGame = () => {
    setGameStage("play");
    setGameError("");
    setGameBusy(false);
    setGameSession((value) => value + 1);
    setGameOpen(true);
  };

  const finishGame = async () => {
    if (gameBusy) return;
    setGameBusy(true);
    setGameError("");
    try {
      const response = await fetch(`/api/orders/${token}/game`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; mode?: string; bonus?: PublicBonus | null; error?: string }
        | null;
      if (!response.ok || !data?.ok) {
        setGameStage("error");
        setGameError(data?.error ?? "Не удалось засчитать игру. Попробуйте ещё раз.");
        return;
      }
      if (data.bonus) {
        setOrder((current) => ({ ...current, bonus: data.bonus ?? null }));
      }
      setGameStage("result");
      void refresh(true);
    } catch {
      setGameStage("error");
      setGameError("Сеть недоступна. Результат не потерян — попробуйте ещё раз.");
    } finally {
      setGameBusy(false);
    }
  };

  const statusIndex =
    order.status === "new" ? 0 : order.status === "confirmed" ? 1 : order.status === "completed" ? 2 : -1;
  const steps = [
    { label: "Заказ принят", text: "Сохранён в базе, ждёт кухню." },
    { label: "Подтверждён", text: "Сумма и время согласованы." },
    { label: "Выполнен", text: "Заказ передан или доставлен." },
  ];
  const gameAvailable =
    order.gameMode !== "off" && order.status !== "cancelled" && !order.bonus;
  const privateLink = `/order/${token}`;

  return (
    <>
      <SiteHeader compact cartEnabled={false} />
      <main className="page order-page" id="main">
        {showCreated ? (
          <div className="form-success" style={{ marginBottom: 18 }} role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m5 12 4 4L19 6" />
            </svg>
            <span>
              Заказ сохранён. Это приватная страница: сохраните ссылку — по ней видно
              статус, сумму и время. Не пересылайте её посторонним.
            </span>
            <button
              type="button"
              className="text-link"
              style={{ marginLeft: "auto", background: "none", border: 0, font: "inherit" }}
              onClick={() => setShowCreated(false)}
            >
              Скрыть
            </button>
          </div>
        ) : null}

        <div className="order-hero">
          <div className="order-hero__main">
            <span className="private-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Приватная страница заказа
            </span>
            <h1>{order.orderNo}</h1>
            <div className="order-hero__meta">
              <span className={`status-pill status-pill--${order.status}`} data-testid="order-status">
                {order.statusLabel}
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                Создан {formatDateTime(order.createdAt, order.timezone)}
              </span>
              <span>{deliveryLabel(order.deliveryMethod)}</span>
            </div>
          </div>
          <div className="order-actions">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => void refresh()}
              disabled={refreshing}
              data-testid="refresh-order"
            >
              {refreshing ? <span className="spinner" aria-hidden="true" /> : null}
              Обновить
            </button>
            <button
              type="button"
              className="btn btn--soft btn--small"
              onClick={() => void copyLink()}
              data-testid="copy-link"
            >
              {copied ? "Скопировано" : "Копировать ссылку"}
            </button>
            <Link href="/#menu" className="btn btn--primary btn--small">
              Новый заказ
            </Link>
          </div>
        </div>

        {refreshError ? (
          <div className="notice-bar" style={{ marginTop: 14 }} role="status">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 7.5v.2" />
            </svg>
            {refreshError}
          </div>
        ) : null}

        <div className="order-grid">
          <div className="order-main">
            <section className="status-card">
              <div className="status-card__head">
                <h2 style={{ fontSize: "1.08rem" }}>Статус заказа</h2>
                <span className="order-refresh">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
                  </svg>
                  обновляется автоматически
                </span>
              </div>

              {order.status === "cancelled" ? (
                <div className="form-alert" role="status">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m9 9 6 6M15 9l-6 6" />
                  </svg>
                  <span>Заказ отменён. Если это ошибка, свяжитесь с кафе по телефону.</span>
                </div>
              ) : (
                <div className="timeline">
                  {steps.map((step, index) => {
                    const done = index <= statusIndex;
                    return (
                      <div className="timeline__item" key={step.label}>
                        <span
                          className={`timeline__dot${done ? " timeline__dot--done" : ""}`}
                          aria-hidden="true"
                        >
                          {done ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                              <path d="m5 12 4 4L19 6" />
                            </svg>
                          ) : null}
                        </span>
                        <div className="timeline__body">
                          <strong>{step.label}</strong>
                          <span>{done ? step.text : "Ожидает"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="order-card">
              <h2>Состав заказа</h2>
              <div>
                {order.items.map((line) => (
                  <div className="order-line" key={line.key}>
                    <div className="order-line__main">
                      <strong>
                        {line.name} × {line.qty}
                      </strong>
                      <span>
                        {line.variantLabel}
                        {line.optionLabels.length > 0
                          ? ` · ${line.optionLabels.join(", ")}`
                          : ""}
                      </span>
                      {line.quote && line.customDescription ? (
                        <span>{line.customDescription}</span>
                      ) : null}
                    </div>
                    <div className="order-line__price">
                      {line.lineTotal !== null ? formatRub(line.lineTotal) : "По запросу"}
                      {line.unitPrice !== null && line.qty > 1 ? (
                        <small>{formatRub(line.unitPrice)} / шт.</small>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-totals">
                <div className="summary-row">
                  <span>Блюда с известной ценой</span>
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
                    <span>Выезд за город</span>
                    <strong>{formatRub(order.totals.outOfTownFee)}</strong>
                  </div>
                ) : null}
                <div className="summary-total">
                  <span>{order.finalTotal ? "Итоговая сумма" : "Известная сумма"}</span>
                  <strong data-testid="order-total">
                    {formatRub(order.finalTotal ?? order.totals.totalKnown)}
                  </strong>
                </div>
                {order.finalTotal && order.totals.hasQuote ? (
                  <p className="tiny muted">
                    Владелец согласовал итог с учётом «Своего блюда».
                  </p>
                ) : null}
                {order.totals.hasQuote && !order.finalTotal ? (
                  <div className="summary-quote-note">
                    «Своё блюдо» — по запросу. Цена не входит в известную сумму, пока
                    владелец не подтвердит итог.
                  </div>
                ) : null}
              </div>
            </section>

            {order.photos.length > 0 ? (
              <section className="order-card">
                <h2>Фотографии к заказу</h2>
                <div className="order-photo-grid">
                  {order.photos.map((photo) => (
                    <a
                      className="order-photo"
                      key={photo.id}
                      href={`/api/orders/${token}/photos/${photo.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/orders/${token}/photos/${photo.id}`}
                        alt="Фото, приложенное к заказу"
                        loading="lazy"
                        width={photo.width}
                        height={photo.height}
                      />
                    </a>
                  ))}
                </div>
                <p className="field__hint" style={{ marginTop: 8 }}>
                  Фото доступны только по этой приватной ссылке и в кабинете владельца.
                </p>
              </section>
            ) : null}

            {order.events.length > 1 ? (
              <section className="order-card">
                <h2>История</h2>
                <div className="timeline">
                  {[...order.events].reverse().map((event, index) => (
                    <div className="timeline__item" key={`${event.createdAt}-${index}`}>
                      <span className="timeline__dot timeline__dot--done" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                      </span>
                      <div className="timeline__body">
                        <strong>{event.label}</strong>
                        <span>{formatDateTime(event.createdAt, order.timezone)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="order-side">
            <section className="terms-card">
              <h2>Условия</h2>
              {order.finalTotal ? (
                <>
                  <div className="terms-row">
                    <span>Итоговая цена</span>
                    <strong>{formatRub(order.finalTotal)}</strong>
                  </div>
                  <div className="terms-row">
                    <span>Согласованное время</span>
                    <strong>
                      {order.agreedAt
                        ? formatDateTime(order.agreedAt, order.timezone)
                        : "уточняется"}
                    </strong>
                  </div>
                </>
              ) : (
                <p className="small muted">
                  Кухня проверит состав и подтвердит итоговую цену и время. После этого они
                  появятся здесь — страница обновляется автоматически.
                </p>
              )}
              <div className="summary-divider" />
              <div className="info-list">
                <div className="info-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
                    <circle cx="12" cy="10" r="2.4" />
                  </svg>
                  <span>
                    <small>{order.deliveryMethod === "delivery" ? "Доставка" : "Самовывоз"}</small>
                    {order.deliveryMethod === "delivery"
                      ? order.address
                      : company.address}
                    {order.outOfTown ? " · за город" : ""}
                  </span>
                </div>
                {order.preferredDate ? (
                  <div className="info-row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M8 3v4M16 3v4M3 10h18" />
                    </svg>
                    <span>
                      <small>Пожелание по времени</small>
                      {formatDateLong(order.preferredDate)}
                      {order.preferredTime ? `, ${order.preferredTime}` : ""}
                    </span>
                  </div>
                ) : null}
                <div className="info-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" />
                  </svg>
                  <span>
                    <small>Связаться</small>
                    {company.phone ? (
                      <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>
                        {company.phone}
                      </a>
                    ) : (
                      "Телефон в демо не указан"
                    )}
                  </span>
                </div>
              </div>
              {order.comment ? (
                <div className="admin-note">
                  <strong>Комментарий:</strong> {order.comment}
                </div>
              ) : null}
            </section>

            <section className={`bonus-card${order.gameMode === "off" ? " bonus-card--off" : ""}`}>
              <h2>Игра «Чистый поднос»</h2>
              {order.gameMode === "off" ? (
                <p>Игра временно отключена владельцем. Заказ от этого не меняется.</p>
              ) : order.bonus ? (
                <>
                  <p>
                    {order.bonus.status === "redeemed"
                      ? "Бонус уже использован."
                      : "Бонус на следующий заказ. Он не уменьшает сумму текущего заказа."}
                  </p>
                  <div className="bonus-code" data-testid="bonus-code">
                    <span>{order.bonus.code}</span>
                    <small>{formatRub(order.bonus.amount)}</small>
                  </div>
                  <p>
                    Минимальный заказ — {formatRub(order.bonus.minOrder)}. Действует до{" "}
                    {formatDateTime(order.bonus.expiresAt, order.timezone)}. Активирует
                    владелец вручную.
                  </p>
                  <span className="status-pill status-pill--neutral">
                    {order.bonus.status === "redeemed" ? "Использован" : "Выдан"}
                  </span>
                </>
              ) : order.status === "cancelled" ? (
                <p>Для отменённого заказа игра недоступна.</p>
              ) : order.status !== "completed" ? (
                <p>
                  Игра откроется, когда владелец отметит заказ выполненным. Сейчас статус —{" "}
                  {order.statusLabel.toLowerCase()}.
                </p>
              ) : (
                <>
                  <p>
                    {order.gameMode === "bonus"
                      ? "Смойте соус с 3D-подноса и получите бонус на следующий заказ."
                      : "Смойте соус с 3D-подноса. Бонус в этом режиме не начисляется."}
                  </p>
                  <button type="button" className="btn" onClick={openGame} data-testid="open-game">
                    {order.gameMode === "bonus" ? "Играть за бонус" : "Играть"}
                  </button>
                </>
              )}
            </section>

            <section className="order-card">
              <h2>Приватная ссылка</h2>
              <div className="copy-row">
                <input
                  id="private-link"
                  className="input"
                  readOnly
                  value={privateLink}
                  onFocus={(event) => event.target.select()}
                  aria-label="Приватная ссылка на заказ"
                />
                <button type="button" className="btn btn--ghost btn--small" onClick={() => void copyLink()}>
                  {copied ? "Готово" : "Копировать"}
                </button>
              </div>
              <p className="field__hint" style={{ marginTop: 7 }}>
                Ссылка содержит случайный токен. Не публикуйте её и не пересылайте тем, кто
                не участвует в заказе.
              </p>
            </section>
          </aside>
        </div>
      </main>

      <SiteFooter company={company} />

      {gameOpen ? (
        <div
          className="game-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !gameBusy) setGameOpen(false);
          }}
        >
          <div className="game-panel">
            <div className="game-panel__head">
              <div>
                <h2 id="game-title">Чистый поднос</h2>
                <p>Сотрите соус пальцем или мышью. Режим вращения — отдельно.</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setGameOpen(false)}
                disabled={gameBusy}
                aria-label="Закрыть игру"
                ref={closeGameRef}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="game-body">
              {gameStage === "play" ? (
                <>
                  <TrayGame
                    key={gameSession}
                    onFinished={() => void finishGame()}
                    busy={gameBusy}
                    error={gameError || null}
                  />
                  <div className="game-foot">
                    <p>
                      Игра — необязательный бонус. Текущий заказ не получает скидку: код
                      действует на следующий и активируется вручную.
                    </p>
                  </div>
                </>
              ) : null}

              {gameStage === "result" ? (
                <div className="game-result">
                  <span className="game-result__icon" aria-hidden="true">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  </span>
                  <h3>Поднос чистый</h3>
                  {order.bonus ? (
                    <>
                      <p>
                        Бонус {formatRub(order.bonus.amount)} на следующий заказ. Покажите
                        код владельцу — он активирует его вручную.
                      </p>
                      <div className="bonus-code">
                        <span>{order.bonus.code}</span>
                        <small>до {formatDateTime(order.bonus.expiresAt, order.timezone)}</small>
                      </div>
                      <p className="tiny muted">
                        Минимальный заказ — {formatRub(order.bonus.minOrder)}. Этот заказ
                        бонус не уменьшает.
                      </p>
                    </>
                  ) : (
                    <p>
                      Спасибо за игру! В этом режиме бонус не начисляется, но поднос
                      выглядит отлично.
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setGameOpen(false)}
                  >
                    Вернуться к заказу
                  </button>
                </div>
              ) : null}

              {gameStage === "error" ? (
                <div className="game-result">
                  <span className="game-result__icon" aria-hidden="true">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 11v5M12 7.5v.2" />
                    </svg>
                  </span>
                  <h3>Не удалось засчитать результат</h3>
                  <p>{gameError || "Попробуйте ещё раз — сервер не выдал бонус."}</p>
                  <div className="hero__actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void finishGame()}
                      disabled={gameBusy}
                    >
                      {gameBusy ? "Проверяем…" : "Попробовать снова"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => {
                        setGameStage("play");
                        setGameError("");
                        setGameSession((value) => value + 1);
                      }}
                    >
                      Играть заново
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
