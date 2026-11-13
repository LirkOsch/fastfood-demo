"use client";

import { useState } from "react";
import { CATEGORIES, MENU_ITEMS, type VariantId } from "@/lib/menu";
import type { PricingSettings } from "@/lib/pricing";
import { Field, SaveBar, useSettingsSave } from "./settings-ui";

type DraftItem = Record<VariantId, string> & { available: boolean };
type Draft = Record<string, DraftItem>;

function toDraft(pricing: PricingSettings): Draft {
  const draft: Draft = {};
  for (const item of MENU_ITEMS) {
    const price = pricing.items[item.id];
    draft[item.id] = {
      standard: price?.standard !== undefined ? String(price.standard) : "",
      large: price?.large !== undefined ? String(price.large) : "",
      single: price?.single !== undefined ? String(price.single) : "",
      available: price?.available ?? true,
    };
  }
  return draft;
}

function parseMoney(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const number = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(number)) return undefined;
  return Math.max(0, Math.min(1000000, Math.round(number)));
}

export function PricingForm({ initial }: { initial: PricingSettings }) {
  const { pending, message, error, fieldErrors, save } = useSettingsSave("pricing");
  const [items, setItems] = useState<Draft>(() => toDraft(initial));
  const [minOrder, setMinOrder] = useState(String(initial.minOrder));
  const [deliveryFee, setDeliveryFee] = useState(String(initial.deliveryFee));
  const [outOfTownFee, setOutOfTownFee] = useState(String(initial.outOfTownFee));
  const [doublePercent, setDoublePercent] = useState(String(initial.doublePercent));
  const [secondSaucePercent, setSecondSaucePercent] = useState(
    String(initial.secondSaucePercent),
  );

  const updateItem = (id: string, patch: Partial<DraftItem>) => {
    setItems((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...initial,
      minOrder: parseMoney(minOrder) ?? 0,
      deliveryFee: parseMoney(deliveryFee) ?? 0,
      outOfTownFee: parseMoney(outOfTownFee) ?? 0,
      doublePercent: Number(doublePercent.replace(",", ".")) || 0,
      secondSaucePercent: Number(secondSaucePercent.replace(",", ".")) || 0,
      items: Object.fromEntries(
        Object.entries(items).map(([id, value]) => [
          id,
          {
            standard: parseMoney(value.standard),
            large: parseMoney(value.large),
            single: parseMoney(value.single),
            available: value.available,
          },
        ]),
      ),
    };
    await save(payload);
  };

  return (
    <form className="admin-form" onSubmit={submit} noValidate>
      <section className="admin-form__section">
        <h2>Правила расчёта</h2>
        <p>
          Итог всегда пересчитывает сервер: базовая цена варианта + процент за двойную начинку +
          процент за второй соус. Каждая надбавка округляется до целого рубля. Минимум заказа
          считается только по блюдам с известной ценой.
        </p>
        <div className="form-grid">
          <Field label="Минимум заказа, ₽" error={fieldErrors.minOrder}>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={minOrder}
              onChange={(event) => setMinOrder(event.target.value)}
            />
          </Field>
          <Field label="Доставка по городу, ₽" error={fieldErrors.deliveryFee}>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={deliveryFee}
              onChange={(event) => setDeliveryFee(event.target.value)}
            />
          </Field>
          <Field label="Выезд за город, ₽" error={fieldErrors.outOfTownFee}>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={outOfTownFee}
              onChange={(event) => setOutOfTownFee(event.target.value)}
            />
          </Field>
          <Field
            label="Двойная начинка, %"
            hint="Надбавка к базовой цене выбранного варианта."
            error={fieldErrors.doublePercent}
          >
            <input
              className="input"
              type="number"
              min={0}
              max={200}
              step={1}
              value={doublePercent}
              onChange={(event) => setDoublePercent(event.target.value)}
            />
          </Field>
          <Field
            label="Второй соус, %"
            hint="Складывается с надбавкой за двойную начинку."
            error={fieldErrors.secondSaucePercent}
          >
            <input
              className="input"
              type="number"
              min={0}
              max={200}
              step={1}
              value={secondSaucePercent}
              onChange={(event) => setSecondSaucePercent(event.target.value)}
            />
          </Field>
        </div>
        <p className="tiny muted">
          Пустое поле цены означает, что вариант недоступен. Позиция «Своё блюдо» всегда считается
          по запросу и не участвует в минимуме.
        </p>
      </section>

      {CATEGORIES.map((category) => {
        const categoryItems = MENU_ITEMS.filter((item) => item.categoryId === category.id);
        if (categoryItems.length === 0) return null;
        const variants = category.variants;
        return (
          <section className="admin-form__section" key={category.id}>
            <h2>{category.title}</h2>
            <p>{category.description}</p>
            <div style={{ overflowX: "auto" }}>
              <table className="price-table">
                <thead>
                  <tr>
                    <th>Позиция</th>
                    {variants.map((variant) => (
                      <th key={variant}>{category.variantLabels[variant] ?? variant}</th>
                    ))}
                    <th>В наличии</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryItems.map((item) => {
                    const value = items[item.id];
                    if (!value) return null;
                    if (item.isCustom) {
                      return (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                            <span className="admin-table__sub">цена по запросу</span>
                          </td>
                          <td colSpan={variants.length}>—</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={value.available}
                              aria-label={`${item.name}: в наличии`}
                              onChange={(event) =>
                                updateItem(item.id, { available: event.target.checked })
                              }
                            />
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          {item.description ? (
                            <span className="admin-table__sub">{item.description}</span>
                          ) : null}
                        </td>
                        {variants.map((variant) => (
                          <td key={variant}>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              aria-label={`${item.name}: ${category.variantLabels[variant] ?? variant}`}
                              value={value[variant]}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  [variant]: event.target.value,
                                } as Partial<DraftItem>)
                              }
                            />
                          </td>
                        ))}
                        <td>
                          <input
                            type="checkbox"
                            checked={value.available}
                            aria-label={`${item.name}: в наличии`}
                            onChange={(event) =>
                              updateItem(item.id, { available: event.target.checked })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <SaveBar pending={pending} message={message} error={error} label="Сохранить цены" />
    </form>
  );
}
