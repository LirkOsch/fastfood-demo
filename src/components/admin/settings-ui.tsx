"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface SaveState {
  pending: boolean;
  message: string;
  error: string;
  fieldErrors: Record<string, string>;
}

const EMPTY: SaveState = {
  pending: false,
  message: "",
  error: "",
  fieldErrors: {},
};

export function useSettingsSave(section: string) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>(EMPTY);

  const reset = () => setState((current) => ({ ...current, message: "", error: "", fieldErrors: {} }));

  const save = async (payload: unknown): Promise<boolean> => {
    setState({ ...EMPTY, pending: true });
    try {
      const response = await fetch(`/api/admin/settings/${section}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; fieldErrors?: Record<string, string> }
        | null;
      if (!response.ok || !data?.ok) {
        setState({
          pending: false,
          message: "",
          error: data?.error ?? "Не удалось сохранить настройки.",
          fieldErrors: data?.fieldErrors ?? {},
        });
        return false;
      }
      setState({
        pending: false,
        message: "Сохранено. Изменения уже видны на сайте.",
        error: "",
        fieldErrors: {},
      });
      router.refresh();
      return true;
    } catch {
      setState({
        pending: false,
        message: "",
        error: "Сеть недоступна. Проверьте подключение и попробуйте снова.",
        fieldErrors: {},
      });
      return false;
    }
  };

  return { ...state, save, reset };
}

export function Field({
  label,
  hint,
  error,
  children,
  full,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "field field--full" : "field"}>
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function SaveBar({
  pending,
  message,
  error,
  label = "Сохранить",
}: {
  pending: boolean;
  message: string;
  error: string;
  label?: string;
}) {
  return (
    <div className="admin-form__foot">
      <span className="small" role="status" aria-live="polite">
        {error ? (
          <span style={{ color: "var(--danger)" }}>{error}</span>
        ) : message ? (
          message
        ) : (
          "Изменения применяются сразу после сохранения."
        )}
      </span>
      <button type="submit" className="btn btn--primary btn--small" disabled={pending}>
        {pending ? "Сохраняем…" : label}
      </button>
    </div>
  );
}
