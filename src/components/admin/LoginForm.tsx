"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BoxMark } from "@/components/site/BoxMark";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const showDemoHint = process.env.NODE_ENV !== "production";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; redirect?: string; error?: string }
        | null;
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "Не удалось войти. Проверьте данные.");
        setPending(false);
        return;
      }
      router.replace(data.redirect ?? "/admin");
      router.refresh();
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
      setPending(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit} noValidate>
        <Link href="/" className="brand" aria-label="На главную">
          <BoxMark className="brand__mark" />
          <span className="brand__text">
            Тёплый бокс
            <small>Кабинет владельца</small>
          </span>
        </Link>

        <div>
          <h1>Вход в кабинет</h1>
          <p className="muted small" style={{ marginTop: 6 }}>
            Здесь подтверждают заказы, меняют меню и выдают бонусы. Это демонстрационный
            проект — не используйте реальные пароли.
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-email">
            E-mail
          </label>
          <input
            id="login-email"
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            inputMode="email"
            required
            data-testid="login-email"
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="login-password">
            Пароль
          </label>
          <input
            id="login-password"
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            data-testid="login-password"
          />
        </div>

        {error ? (
          <div className="form-alert" role="alert" data-testid="login-error">
            <span>{error}</span>
          </div>
        ) : null}

        <button type="submit" className="btn btn--primary btn--block" disabled={pending} data-testid="login-submit">
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {pending ? "Проверяем…" : "Войти"}
        </button>

        {showDemoHint ? (
          <div className="login-hint">
            <strong>Демо-доступ:</strong> owner@teplybox.example · teplybox-demo-2026
            <br />
            Значения по умолчанию из <code>.env.local</code>. В production задайте свои.
          </div>
        ) : null}

        <Link href="/" className="text-link small">
          ← Вернуться на сайт
        </Link>
      </form>
    </div>
  );
}
