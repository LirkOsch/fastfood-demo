"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export function AccessForms({
  admin,
  sessions,
  currentSessionId,
  timezone,
}: {
  admin: { name: string; email: string };
  sessions: SessionInfo[];
  currentSessionId: string;
  timezone: string;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokePending, setRevokePending] = useState(false);
  const [revokeError, setRevokeError] = useState("");

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError("");
    setMessage("");
    if (newPassword !== repeatPassword) {
      setError("Новые пароли не совпадают.");
      return;
    }
    if (newPassword.length < 10) {
      setError("Новый пароль должен быть не короче 10 символов.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "Не удалось изменить пароль.");
        return;
      }
      setMessage("Пароль изменён. Все сессии завершены, войдите заново.");
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      window.setTimeout(() => {
        router.replace("/admin/login");
        router.refresh();
      }, 900);
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  };

  const revokeAll = async () => {
    if (revokePending) return;
    setRevokePending(true);
    setRevokeError("");
    try {
      const response = await fetch("/api/admin/sessions", {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setRevokeError(data?.error ?? "Не удалось завершить сессии.");
        return;
      }
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setRevokeError("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setRevokePending(false);
    }
  };

  return (
    <div className="admin-form">
      <section className="admin-form__section">
        <h2>Учётная запись</h2>
        <div className="admin-lines">
          <div className="admin-line">
            <span>Имя</span>
            <span>{admin.name}</span>
          </div>
          <div className="admin-line">
            <span>E-mail</span>
            <span>{admin.email}</span>
          </div>
          <div className="admin-line">
            <span>Активных сессий</span>
            <span>{sessions.length}</span>
          </div>
        </div>
        <p>
          В демо-проекте один владелец. Пароль хранится в виде bcrypt-хеша, сессии — в виде
          SHA-256-хешей в HttpOnly-cookie.
        </p>
      </section>

      <section className="admin-form__section">
        <h2>Смена пароля</h2>
        <p>После смены пароля все активные сессии завершаются — потребуется войти заново.</p>
        <form onSubmit={changePassword} noValidate>
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="current-password">
                Текущий пароль
              </label>
              <input
                id="current-password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="new-password">
                Новый пароль
              </label>
              <input
                id="new-password"
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <span className="field__hint">Не короче 10 символов.</span>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="repeat-password">
                Повторите новый пароль
              </label>
              <input
                id="repeat-password"
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
                required
              />
            </div>
          </div>
          {error ? (
            <p className="field__error" role="alert" style={{ marginTop: 8 }}>
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="small" role="status" style={{ marginTop: 8 }}>
              {message}
            </p>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button type="submit" className="btn btn--primary btn--small" disabled={pending}>
              {pending ? "Меняем…" : "Сменить пароль"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-form__section">
        <h2>Активные сессии</h2>
        <p>Список устройств, на которых выполнен вход. Текущая сессия отмечена.</p>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Устройство</th>
                <th>Начало</th>
                <th>Истекает</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    {session.userAgent ?? "Неизвестное устройство"}
                    {session.id === currentSessionId ? (
                      <span className="admin-table__sub">эта сессия</span>
                    ) : null}
                  </td>
                  <td>{formatDateTime(session.createdAt, timezone)}</td>
                  <td>{formatDateTime(session.expiresAt, timezone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {revokeOpen ? (
          <div className="admin-danger" style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line)" }}>
            <p className="small" style={{ marginBottom: 8 }}>
              Завершить все сессии, включая текущую? Потребуется войти заново.
            </p>
            {revokeError ? (
              <p className="field__error" role="alert">
                {revokeError}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn--danger btn--small"
                onClick={() => void revokeAll()}
                disabled={revokePending}
              >
                {revokePending ? "Завершаем…" : "Да, завершить все"}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => setRevokeOpen(false)}
                disabled={revokePending}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => setRevokeOpen(true)}
          >
            Завершить все сессии
          </button>
        )}
      </section>

      <section className="admin-form__section">
        <h2>Безопасность демо</h2>
        <p>
          Демо-доступ описан в README. Перед публикацией в интернет задайте собственный пароль в
          <code> .env.local</code>, включите HTTPS и <code>COOKIE_SECURE=true</code>, а также
          ограничьте частоту входов на уровне прокси.
        </p>
      </section>
    </div>
  );
}
