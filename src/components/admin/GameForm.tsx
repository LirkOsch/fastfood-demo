"use client";

import { useState } from "react";
import { formatRub } from "@/lib/format";
import type { GameSettings } from "@/lib/settings";
import { Field, SaveBar, useSettingsSave } from "./settings-ui";

const MODES = [
  {
    id: "off",
    title: "Выключено",
    description: "Игры и бонусов нет. Приватная ссылка работает как обычно.",
  },
  {
    id: "play",
    title: "Только игра",
    description: "Клиент может почистить поднос ради интереса, без бонуса.",
  },
  {
    id: "bonus",
    title: "Игра с бонусом",
    description: "За прохождение выдаётся один код на следующий заказ.",
  },
] as const;

export function GameForm({ initial }: { initial: GameSettings }) {
  const { pending, message, error, fieldErrors, save } = useSettingsSave("game");
  const [form, setForm] = useState<GameSettings>(initial);

  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await save({
      ...form,
      bonusAmount: Number(form.bonusAmount) || 0,
      bonusDays: Number(form.bonusDays) || 1,
      bonusMinOrder: Number(form.bonusMinOrder) || 0,
    });
  };

  return (
    <form className="admin-form" onSubmit={submit} noValidate>
      <section className="admin-form__section">
        <h2>Режим игры</h2>
        <p>
          Игра появляется на приватной странице заказа после того, как заказ выполнен. Код выдаётся
          один раз на заказ и не действует на текущий заказ — только на следующий.
        </p>
        <div className="radio-cards" role="group" aria-label="Режим игры">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className="radio-card"
              aria-pressed={form.mode === mode.id}
              onClick={() => update("mode", mode.id)}
            >
              <strong>{mode.title}</strong>
              <span>{mode.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form__section">
        <h2>Параметры бонуса</h2>
        <p>
          {form.mode === "bonus"
            ? `Сейчас: ${formatRub(form.bonusAmount)} на заказ от ${formatRub(form.bonusMinOrder)}, срок действия ${form.bonusDays} дн.`
            : "Параметры сохраняются, но не применяются, пока режим не переключён на «Игра с бонусом»."}
        </p>
        <div className="form-grid">
          <Field label="Сумма бонуса, ₽" error={fieldErrors.bonusAmount}>
            <input
              className="input"
              type="number"
              min={0}
              max={5000}
              step={50}
              value={form.bonusAmount}
              disabled={form.mode !== "bonus"}
              onChange={(event) => update("bonusAmount", Number(event.target.value))}
            />
          </Field>
          <Field label="Минимальный заказ для бонуса, ₽" error={fieldErrors.bonusMinOrder}>
            <input
              className="input"
              type="number"
              min={0}
              max={100000}
              step={50}
              value={form.bonusMinOrder}
              disabled={form.mode !== "bonus"}
              onChange={(event) => update("bonusMinOrder", Number(event.target.value))}
            />
          </Field>
          <Field label="Срок действия, дней" error={fieldErrors.bonusDays}>
            <input
              className="input"
              type="number"
              min={1}
              max={180}
              step={1}
              value={form.bonusDays}
              disabled={form.mode !== "bonus"}
              onChange={(event) => update("bonusDays", Number(event.target.value))}
            />
          </Field>
          <Field
            label="Префикс кода"
            hint="Латинские буквы и цифры, до 8 символов. Например, BOX."
            error={fieldErrors.codePrefix}
          >
            <input
              className="input"
              value={form.codePrefix}
              maxLength={8}
              disabled={form.mode !== "bonus"}
              onChange={(event) =>
                update("codePrefix", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
            />
          </Field>
        </div>
        <p className="tiny muted">
          Активация кода — только вручную в карточке заказа. Сервер не проверяет честность
          прохождения игры: это осознанное ограничение MVP.
        </p>
      </section>

      <SaveBar pending={pending} message={message} error={error} label="Сохранить игру" />
    </form>
  );
}
