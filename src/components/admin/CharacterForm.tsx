"use client";

import { useState } from "react";
import { BoxMark } from "@/components/site/BoxMark";
import type { CharacterSettings } from "@/lib/settings";
import { Field, SaveBar, useSettingsSave } from "./settings-ui";

const PRESETS = [
  {
    id: "boxy",
    title: "Боксик",
    description: "Коробка для навынос с глазами и улыбкой. Машет с 3D-витрины.",
  },
  {
    id: "bun",
    title: "Булочка",
    description: "Круглый персонаж-булочка. Мягкая альтернатива коробке.",
  },
  {
    id: "none",
    title: "Без персонажа",
    description: "Только блюдо на подиуме: спокойная витрина без масскота.",
  },
] as const;

export function CharacterForm({ initial }: { initial: CharacterSettings }) {
  const { pending, message, error, fieldErrors, save } = useSettingsSave("character");
  const [form, setForm] = useState<CharacterSettings>(initial);

  const update = <K extends keyof CharacterSettings>(key: K, value: CharacterSettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await save(form);
  };

  return (
    <form className="admin-form" onSubmit={submit} noValidate>
      <section className="admin-form__section">
        <h2>Персонаж витрины</h2>
        <p>
          Персонаж появляется рядом с блюдом в 3D-сцене и в подписи блока о кафе. Модели
          процедурные, без сторонних ассетов.
        </p>
        <div className="radio-cards" role="group" aria-label="Персонаж">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="radio-card"
              aria-pressed={form.preset === preset.id}
              onClick={() => update("preset", preset.id)}
            >
              <strong>{preset.title}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
        <div className="form-grid">
          <Field
            label="Имя персонажа"
            hint="Показывается в подписи и репликах."
            error={fieldErrors.name}
          >
            <input
              className="input"
              value={form.name}
              maxLength={40}
              disabled={form.preset === "none"}
              onChange={(event) => update("name", event.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="admin-form__section">
        <h2>Детали</h2>
        <p>Можно оставить только силуэт, если персонаж отвлекает от еды.</p>
        <div className="checkbox-row">
          <input
            id="character-faces"
            type="checkbox"
            checked={form.faces}
            disabled={form.preset === "none"}
            onChange={(event) => update("faces", event.target.checked)}
          />
          <label htmlFor="character-faces">
            Показывать глаза и улыбку
          </label>
        </div>
        <div className="checkbox-row">
          <input
            id="character-phrases"
            type="checkbox"
            checked={form.phrases}
            disabled={form.preset === "none"}
            onChange={(event) => update("phrases", event.target.checked)}
          />
          <label htmlFor="character-phrases">
            Показывать реплики в 3D-сцене
          </label>
        </div>
        {form.preset !== "none" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BoxMark className="brand__mark" />
            <span className="small muted">
              Предпросмотр: {form.name || "Без имени"} · {form.faces ? "с лицом" : "без лица"} ·{" "}
              {form.phrases ? "с репликами" : "без реплик"}
            </span>
          </div>
        ) : null}
      </section>

      <SaveBar pending={pending} message={message} error={error} label="Сохранить персонажа" />
    </form>
  );
}
