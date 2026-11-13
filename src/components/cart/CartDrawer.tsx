"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { FoodGlyph } from "@/components/site/FoodGlyph";
import { calculateOrder, type PricingSettings } from "@/lib/pricing";
import { getItem, getVariantLabel } from "@/lib/menu";
import { formatRub } from "@/lib/format";

export function CartDrawer({ pricing }: { pricing: PricingSettings }) {
  const {
    lines,
    isOpen,
    closeCart,
    removeLine,
    updateQty,
    count,
    hydrated,
  } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.classList.contains("is-locked");
    document.body.classList.add("is-locked");
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (!previous) document.body.classList.remove("is-locked");
    };
  }, [isOpen, closeCart]);

  const calculation = useMemo(
    () =>
      calculateOrder(lines, pricing, {
        deliveryMethod: "pickup",
        outOfTown: false,
      }),
    [lines, pricing],
  );

  if (!isOpen) return null;

  const minProgress =
    calculation.minOrder > 0
      ? Math.min(100, Math.round((calculation.knownFood / calculation.minOrder) * 100))
      : 100;

  return (
    <>
      <div className="cart-backdrop" onClick={closeCart} aria-hidden="true" />
      <div
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        ref={panelRef}
      >
        <div className="cart-drawer__head">
          <h2 id="cart-title">
            Корзина
            <small>
              {hydrated
                ? `${count} ${count === 1 ? "позиция" : count > 1 && count < 5 ? "позиции" : "позиций"}`
                : "Загрузка…"}
            </small>
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={closeCart}
            aria-label="Закрыть корзину"
            ref={closeRef}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="cart-empty" data-testid="cart-empty">
            <span className="cart-empty__icon">
              <FoodGlyph kind="box" className="item-card__glyph" />
            </span>
            <h3>Пока пусто</h3>
            <p>Выберите блюдо в меню — соберём заказ и покажем сумму без сюрпризов.</p>
            <Link href="/#menu" className="btn btn--primary" onClick={closeCart}>
              Перейти к меню
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-body">
              {calculation.lines.map((line) => {
                const raw = lines.find((entry) => entry.key === line.key);
                if (!raw) return null;
                const item = getItem(line.itemId);
                const showControls = !line.quote;
                return (
                  <div className="cart-line" key={line.key} data-testid="cart-line">
                    <span
                      className="cart-line__art"
                      style={undefined}
                      aria-hidden="true"
                    >
                      <FoodGlyph kind={item?.model ?? "box"} />
                    </span>
                    <div className="cart-line__main">
                      <span className="cart-line__name">{line.name}</span>
                      <span className="cart-line__meta">
                        {line.variantLabel}
                        {line.optionLabels.length > 0
                          ? ` · ${line.optionLabels.join(", ")}`
                          : ""}
                      </span>
                      {line.quote ? (
                        <>
                          <span className="cart-line__quote">Цена по запросу</span>
                          {line.customDescription ? (
                            <span className="cart-line__meta">
                              {line.customDescription.slice(0, 90)}
                              {line.customDescription.length > 90 ? "…" : ""}
                            </span>
                          ) : null}
                          <span className="cart-line__meta">
                            Нужно хотя бы одно фото при оформлении
                          </span>
                        </>
                      ) : (
                        <div className="cart-line__controls">
                          <span className="mini-stepper">
                            <button
                              type="button"
                              onClick={() => updateQty(line.key, raw.qty - 1)}
                              aria-label={`Уменьшить количество: ${line.name}`}
                            >
                              −
                            </button>
                            <output aria-label={`Количество: ${line.name}`}>{raw.qty}</output>
                            <button
                              type="button"
                              onClick={() => updateQty(line.key, raw.qty + 1)}
                              aria-label={`Увеличить количество: ${line.name}`}
                              disabled={raw.qty >= 50}
                            >
                              +
                            </button>
                          </span>
                          <button
                            type="button"
                            className="cart-line__remove"
                            onClick={() => removeLine(line.key)}
                          >
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="cart-line__price">
                      {line.lineTotal !== null ? formatRub(line.lineTotal) : "По запросу"}
                    </span>
                  </div>
                );
              })}

              {calculation.hasQuote ? (
                <div className="cart-note">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5M12 7.5v.2" />
                  </svg>
                  <span>
                    В заказе есть «Своё блюдо». Его стоимость мы согласуем отдельно — она
                    не входит в известную сумму и минимум заказа.
                  </span>
                </div>
              ) : null}
            </div>

            <div className="cart-foot">
              <div className="min-order-bar">
                <span>
                  {calculation.knownFood >= calculation.minOrder
                    ? "Минимум заказа набран"
                    : `До минимума ${formatRub(calculation.minOrder - calculation.knownFood)}`}
                </span>
                <span className="min-order-bar__track" aria-hidden="true">
                  <span
                    className="min-order-bar__fill"
                    style={{ width: `${minProgress}%` }}
                  />
                </span>
              </div>
              {calculation.minUplift > 0 ? (
                <div className="cart-total-row">
                  <span>Доплата до минимума</span>
                  <strong className="small">{formatRub(calculation.minUplift)}</strong>
                </div>
              ) : null}
              <div className="cart-total-row">
                <span>Известная сумма</span>
                <strong data-testid="cart-total">{formatRub(calculation.foodCharged)}</strong>
              </div>
              <p className="tiny muted">
                Доставка и выезд за город добавляются на оформлении. Точную сумму и время
                подтвердит владелец.
              </p>
              <Link
                href="/checkout"
                className="btn btn--primary btn--block"
                onClick={closeCart}
                data-testid="go-checkout"
              >
                Перейти к оформлению
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
