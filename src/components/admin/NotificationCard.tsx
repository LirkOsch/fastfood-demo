"use client";

import { useState } from "react";

export function NotificationCard({ configured }: { configured: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const test = async () => {
    if (pending) return;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/notifications/test", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "Не удалось отправить сообщение.");
        return;
      }
      setMessage("Сообщение отправлено — проверьте чат.");
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel__head">
        <h2>Уведомления</h2>
        <span className={`status-pill status-pill--${configured ? "completed" : "cancelled"}`}>
          {configured ? "Telegram" : "выключены"}
        </span>
      </div>
      <div
        className="admin-panel__body"
        style={{ display: "flex", flexDirection: "column", gap: 9 }}
      >
        <p className="small muted">
          {configured
            ? "Новый заказ приходит в чат сразу после оформления, а смена статуса — после подтверждения."
            : "Пока выключены. Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменные окружения проекта — и заказы будут приходить в Telegram."}
        </p>
        <button
          type="button"
          className="btn btn--ghost btn--small btn--block"
          onClick={() => void test()}
          disabled={pending}
        >
          {pending
            ? "Отправляем…"
            : configured
              ? "Отправить проверочное сообщение"
              : "Проверить настройку"}
        </button>
        {message ? (
          <span className="small" role="status">
            {message}
          </span>
        ) : null}
        {error ? (
          <span className="small" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
