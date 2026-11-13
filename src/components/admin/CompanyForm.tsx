"use client";

import { useState } from "react";
import type { CompanySettings } from "@/lib/settings";
import { Field, SaveBar, useSettingsSave } from "./settings-ui";

const TIMEZONES = [
  "Europe/Kaliningrad",
  "Europe/Moscow",
  "Europe/Samara",
  "Asia/Yekaterinburg",
  "Asia/Omsk",
  "Asia/Novosibirsk",
  "Asia/Krasnoyarsk",
  "Asia/Irkutsk",
  "Asia/Yakutsk",
  "Asia/Vladivostok",
  "Asia/Magadan",
  "Asia/Kamchatka",
];

export function CompanyForm({ initial }: { initial: CompanySettings }) {
  const { pending, message, error, fieldErrors, save } = useSettingsSave("company");
  const [form, setForm] = useState<CompanySettings>(initial);

  const update = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await save(form);
  };

  return (
    <form className="admin-form" onSubmit={submit} noValidate>
      <section className="admin-form__section">
        <h2>Основное</h2>
        <p>
          Название и описание показываются на витрине, в шапке и подвале сайта. Это демо-проект:
          контакты и адрес вымышленные.
        </p>
        <div className="form-grid">
          <Field label="Название кафе" error={fieldErrors.name}>
            <input
              className="input"
              value={form.name}
              maxLength={60}
              onChange={(event) => update("name", event.target.value)}
              required
            />
          </Field>
          <Field label="Слоган" error={fieldErrors.tagline}>
            <input
              className="input"
              value={form.tagline}
              maxLength={100}
              onChange={(event) => update("tagline", event.target.value)}
            />
          </Field>
          <Field
            label="Описание"
            hint="1–3 предложения для блока «О кафе»."
            error={fieldErrors.description}
            full
          >
            <textarea
              className="textarea"
              value={form.description}
              maxLength={800}
              rows={4}
              onChange={(event) => update("description", event.target.value)}
            />
          </Field>
          <Field label="Юридическое имя / подпись" error={fieldErrors.legalName} full>
            <input
              className="input"
              value={form.legalName}
              maxLength={160}
              onChange={(event) => update("legalName", event.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="admin-form__section">
        <h2>Контакты и зона доставки</h2>
        <p>Телефон может быть пустым — тогда на сайте останется только почта.</p>
        <div className="form-grid">
          <Field label="Телефон" hint="Формат: +7 900 000-00-00" error={fieldErrors.phone}>
            <input
              className="input"
              type="tel"
              value={form.phone}
              maxLength={25}
              placeholder="+7 900 000-00-00"
              onChange={(event) => update("phone", event.target.value)}
            />
          </Field>
          <Field label="E-mail" error={fieldErrors.email}>
            <input
              className="input"
              type="email"
              value={form.email}
              maxLength={120}
              onChange={(event) => update("email", event.target.value)}
            />
          </Field>
          <Field label="Город" error={fieldErrors.city}>
            <input
              className="input"
              value={form.city}
              maxLength={80}
              onChange={(event) => update("city", event.target.value)}
            />
          </Field>
          <Field label="Адрес" error={fieldErrors.address}>
            <input
              className="input"
              value={form.address}
              maxLength={160}
              onChange={(event) => update("address", event.target.value)}
            />
          </Field>
          <Field label="Зона доставки" error={fieldErrors.deliveryArea}>
            <input
              className="input"
              value={form.deliveryArea}
              maxLength={160}
              onChange={(event) => update("deliveryArea", event.target.value)}
            />
          </Field>
          <Field label="Часы работы" error={fieldErrors.workingHours}>
            <input
              className="input"
              value={form.workingHours}
              maxLength={120}
              onChange={(event) => update("workingHours", event.target.value)}
            />
          </Field>
          <Field
            label="Часовой пояс"
            hint="По нему считаются даты заказов и согласованное время."
            error={fieldErrors.timezone}
          >
            <select
              className="select"
              value={TIMEZONES.includes(form.timezone) ? form.timezone : "Europe/Samara"}
              onChange={(event) => update("timezone", event.target.value)}
            >
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="admin-form__section">
        <h2>Акцентный цвет</h2>
        <p>
          Цвет кнопок, ссылок и подсветки. Выбирайте достаточно контрастный оттенок: подписи на
          кнопках автоматически становятся светлыми или тёмными.
        </p>
        <div className="form-grid">
          <Field label="Оттенок" error={fieldErrors.accent}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={form.accent}
                aria-label="Выбрать цвет"
                style={{ width: 48, height: 40, padding: 2, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)" }}
                onChange={(event) => update("accent", event.target.value)}
              />
              <input
                className="input"
                value={form.accent}
                maxLength={7}
                onChange={(event) => update("accent", event.target.value)}
              />
            </div>
          </Field>
        </div>
      </section>

      <SaveBar pending={pending} message={message} error={error} />
    </form>
  );
}
