"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useCart } from "@/components/cart/CartProvider";
import {
  PhotoField,
  type DraftPhotoView,
} from "@/components/checkout/PhotoField";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  clearDraft,
  clearDraftPhotos,
  emptyDraft,
  loadDraft,
  loadDraftPhotos,
  newIdempotencyKey,
  saveDraft,
  saveDraftPhotos,
  type CheckoutDraft,
} from "@/lib/client/draft";
import { calculateOrder, type PricingSettings } from "@/lib/pricing";
import type { CompanySettings } from "@/lib/settings";
import { formatRub, normalizePhone } from "@/lib/format";
import { CLIENT_MAX_BYTES, compressPhoto } from "@/lib/client/photos";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = CLIENT_MAX_BYTES;
const MAX_PHOTOS = 3;

interface CheckoutProps {
  company: CompanySettings;
  pricing: PricingSettings;
}

export function CheckoutClient({ company, pricing }: CheckoutProps) {
  const router = useRouter();
  const { lines, hydrated, clearCart, openCart } = useCart();
  const [draft, setDraft] = useState<CheckoutDraft>(() =>
    emptyDraft(newIdempotencyKey()),
  );
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [photos, setPhotos] = useState<DraftPhotoView[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const restoredRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const stored = loadDraft();
    const nextDraft = stored ?? emptyDraft(newIdempotencyKey());
    setDraft(nextDraft);
    if (
      stored &&
      (stored.customerName ||
        stored.phone ||
        stored.address ||
        stored.comment ||
        stored.preferredDate ||
        stored.preferredTime)
    ) {
      setRestored(true);
    }

    void loadDraftPhotos().then((files) => {
      if (files.length === 0) return;
      const views = files.map((file) => ({
        id: `restored-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        url: URL.createObjectURL(file),
      }));
      setPhotos(views);
      setRestored(true);
    });

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const ok = saveDraft(draft);
      if (!ok) setStorageWarning(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, ready]);

  useEffect(() => {
    if (!formError) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [formError]);

  const update = <K extends keyof CheckoutDraft>(key: K, value: CheckoutDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
    setFormError("");
  };

  const calculation = useMemo(
    () =>
      calculateOrder(lines, pricing, {
        deliveryMethod: draft.deliveryMethod,
        outOfTown: draft.deliveryMethod === "delivery" && draft.outOfTown,
      }),
    [lines, pricing, draft.deliveryMethod, draft.outOfTown],
  );

  const hasCustom = lines.some((line) => line.itemId === "custom");
  const customLine = calculation.lines.find((line) => line.quote);
  const minProgress =
    calculation.minOrder > 0
      ? Math.min(100, Math.round((calculation.knownFood / calculation.minOrder) * 100))
      : 100;
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: company.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [company.timezone],
  );

  const persistPhotos = (next: DraftPhotoView[]) => {
    void saveDraftPhotos(next.map((photo) => photo.file)).then((ok) => {
      if (!ok) setStorageWarning(true);
    });
  };

  const addFiles = async (files: File[]) => {
    setPhotoError("");
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoError("Можно приложить не больше трёх фотографий.");
      return;
    }
    const accepted: DraftPhotoView[] = [];
    let message = "";
    for (const file of files) {
      if (accepted.length >= remaining) {
        message = "Можно приложить не больше трёх фотографий.";
        break;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        message = `«${file.name}» не подходит: нужен JPEG, PNG или WebP.`;
        continue;
      }
      if (file.size === 0) {
        message = `«${file.name}» пустой. Выберите другой файл.`;
        continue;
      }
      // Сжимаем в браузере: сервер принимает запрос не тяжелее 4.5 МБ.
      let ready = file;
      try {
        ready = await compressPhoto(file);
      } catch {
        ready = file;
      }
      if (ready.size > MAX_BYTES) {
        message = `«${file.name}» не удалось ужать до 4 МБ. Выберите фото поменьше.`;
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file: ready,
        url: URL.createObjectURL(ready),
      });
    }
    if (accepted.length > 0) {
      const next = [...photos, ...accepted];
      setPhotos(next);
      persistPhotos(next);
    }
    if (message) setPhotoError(message);
  };

  const removePhoto = (id: string) => {
    const target = photos.find((photo) => photo.id === id);
    if (target) URL.revokeObjectURL(target.url);
    const next = photos.filter((photo) => photo.id !== id);
    setPhotos(next);
    setPhotoError("");
    persistPhotos(next);
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (draft.customerName.trim().length < 2) {
      next.customerName = "Как к вам обращаться?";
    }
    if (!normalizePhone(draft.phone)) {
      next.phone = "Укажите российский номер телефона.";
    }
    if (draft.deliveryMethod === "delivery" && draft.address.trim().length < 5) {
      next.address = "Укажите улицу, дом и квартиру.";
    }
    if (draft.preferredDate && draft.preferredDate < today) {
      next.preferredDate = "Дата уже прошла. Выберите другой день.";
    }
    if (draft.preferredTime && !draft.preferredDate) {
      next.preferredDate = "Чтобы указать время, выберите дату.";
    }
    if (!draft.consent) {
      next.consent = "Нужно согласие на обработку персональных данных.";
    }
    if (lines.length === 0) {
      next.items = "Корзина пуста.";
    }
    if (hasCustom) {
      if (!customLine?.customDescription || customLine.customDescription.trim().length < 10) {
        next.items = "Опишите своё блюдо подробнее в конструкторе.";
      }
      if (photos.length < 1) {
        next.photos = "Для своего блюда нужно хотя бы одно фото.";
      }
    }
    return next;
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFormError(
        nextErrors.photos ??
          nextErrors.items ??
          "Проверьте выделенные поля — и можно отправлять.",
      );
      return;
    }

    setSubmitting(true);
    setFormError("");
    setErrors({});

    const payload = {
      idempotencyKey: draft.idempotencyKey,
      items: lines,
      customerName: draft.customerName.trim(),
      phone: draft.phone.trim(),
      deliveryMethod: draft.deliveryMethod,
      address: draft.deliveryMethod === "delivery" ? draft.address.trim() : "",
      outOfTown: draft.deliveryMethod === "delivery" ? draft.outOfTown : false,
      preferredDate: draft.preferredDate,
      preferredTime: draft.preferredDate ? draft.preferredTime : "",
      comment: draft.comment.trim(),
      consent: draft.consent,
    };

    const body = new FormData();
    body.set("payload", JSON.stringify(payload));
    for (const photo of photos) {
      // Подстраховка: черновик мог восстановиться из старого файла — сжимаем
      // прямо перед отправкой, чтобы влезть в лимит тела запроса.
      let file = photo.file;
      try {
        file = await compressPhoto(file);
      } catch {
        // Оставляем как есть — сервер вернёт понятную ошибку.
      }
      body.append("photos", file, file.name);
    }

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            token?: string;
            url?: string;
            error?: string;
            fieldErrors?: Record<string, string>;
          }
        | null;

      if (!response.ok || !data?.ok || !data.token) {
        setErrors(data?.fieldErrors ?? {});
        setFormError(
          data?.error ??
            (response.status === 429
              ? "Слишком много отправок. Подождите пару минут."
              : "Не удалось отправить заказ. Данные остались в форме — попробуйте ещё раз."),
        );
        setSubmitting(false);
        return;
      }

      clearCart();
      clearDraft();
      await clearDraftPhotos();
      for (const photo of photos) URL.revokeObjectURL(photo.url);
      router.push(`/order/${data.token}?created=1`);
    } catch {
      setFormError(
        "Сеть недоступна или сервер не ответил. Заказ не отправлен, все данные сохранены — попробуйте ещё раз.",
      );
      setSubmitting(false);
    }
  };

  if (!hydrated) {
    return (
      <>
        <SiteHeader compact />
        <main className="page checkout-page" id="main">
          <div className="empty-state">
            <span className="spinner" aria-hidden="true" />
            <p>Загружаем корзину…</p>
          </div>
        </main>
      </>
    );
  }

  if (lines.length === 0) {
    return (
      <>
        <SiteHeader compact />
        <main className="page checkout-page" id="main">
          <div className="empty-state" data-testid="empty-cart">
            <span className="cart-empty__icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L21.5 7H6" />
                <circle cx="10" cy="20" r="1.3" />
                <circle cx="18" cy="20" r="1.3" />
              </svg>
            </span>
            <h2>Корзина пуста</h2>
            <p>
              Добавьте блюда в меню — и мы посчитаем известную сумму, доставку и минимум
              заказа.
            </p>
            <Link href="/#menu" className="btn btn--primary">
              Перейти к меню
            </Link>
          </div>
        </main>
        <SiteFooter company={company} />
      </>
    );
  }

  return (
    <>
      <SiteHeader compact />
      <main className="page checkout-page" id="main">
        <div className="checkout-head">
          <span className="eyebrow">Оформление</span>
          <h1>Почти готово</h1>
          <p className="lead">
            Оставьте контакты и способ получения. После отправки появится приватная
            ссылка со статусом — сохраните её.
          </p>
          {restored ? (
            <div className="form-success" style={{ marginTop: 6 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
              <span>
                Черновик восстановлен на этом устройстве. Можно продолжить с того места,
                где вы остановились.
              </span>
            </div>
          ) : null}
        </div>

        <form className="checkout-grid" onSubmit={submit} noValidate id="checkout-form">
          <div className="checkout-form">
            <section className="form-card">
              <div className="form-card__head">
                <div>
                  <h2>Контакты и получение</h2>
                  <p>Позвоним только по заказу, без рассылок.</p>
                </div>
                <span className="form-card__num" aria-hidden="true">01</span>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="customerName">
                    Имя <span>*</span>
                  </label>
                  <input
                    id="customerName"
                    className="input"
                    value={draft.customerName}
                    onChange={(event) => update("customerName", event.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    aria-invalid={Boolean(errors.customerName)}
                    aria-describedby={errors.customerName ? "customerName-error" : undefined}
                    data-testid="customer-name"
                  />
                  {errors.customerName ? (
                    <p className="field__error" id="customerName-error">
                      {errors.customerName}
                    </p>
                  ) : null}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="phone">
                    Телефон <span>*</span>
                  </label>
                  <input
                    id="phone"
                    className="input"
                    value={draft.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+7 (900) 000-00-00"
                    maxLength={25}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? "phone-error" : undefined}
                    data-testid="phone"
                  />
                  {errors.phone ? (
                    <p className="field__error" id="phone-error">
                      {errors.phone}
                    </p>
                  ) : null}
                </div>

                <div className="field field--full">
                  <span className="field__label">Способ получения</span>
                  <div className="segment-row" role="group" aria-label="Способ получения">
                    <button
                      type="button"
                      className="delivery-option"
                      aria-pressed={draft.deliveryMethod === "delivery"}
                      onClick={() => update("deliveryMethod", "delivery")}
                      data-testid="delivery-delivery"
                    >
                      <strong>Доставка</strong>
                      <span>
                        от {formatRub(pricing.deliveryFee)} · {company.deliveryArea}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="delivery-option"
                      aria-pressed={draft.deliveryMethod === "pickup"}
                      onClick={() => {
                        update("deliveryMethod", "pickup");
                        update("outOfTown", false);
                      }}
                      data-testid="delivery-pickup"
                    >
                      <strong>Самовывоз</strong>
                      <span>{company.address}</span>
                    </button>
                  </div>
                </div>

                {draft.deliveryMethod === "delivery" ? (
                  <>
                    <div className="field field--full">
                      <label className="field__label" htmlFor="address">
                        Адрес доставки <span>*</span>
                      </label>
                      <input
                        id="address"
                        className="input"
                        value={draft.address}
                        onChange={(event) => update("address", event.target.value)}
                        autoComplete="street-address"
                        placeholder="Улица, дом, квартира, подъезд"
                        maxLength={220}
                        aria-invalid={Boolean(errors.address)}
                        aria-describedby={errors.address ? "address-error" : undefined}
                        data-testid="address"
                      />
                      {errors.address ? (
                        <p className="field__error" id="address-error">
                          {errors.address}
                        </p>
                      ) : null}
                    </div>
                    <div className="field field--full">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={draft.outOfTown}
                          onChange={(event) => update("outOfTown", event.target.checked)}
                          data-testid="out-of-town"
                        />
                        <span>
                          Доставка за город · +{formatRub(pricing.outOfTownFee)}. Если
                          адрес за пределами города, мы уточним зону.
                        </span>
                      </label>
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            <section className="form-card">
              <div className="form-card__head">
                <div>
                  <h2>Время и пожелания</h2>
                  <p>Дата и время необязательны — можно «как можно скорее».</p>
                </div>
                <span className="form-card__num" aria-hidden="true">02</span>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="preferredDate">
                    Дата
                  </label>
                  <input
                    id="preferredDate"
                    type="date"
                    className="input"
                    min={today}
                    value={draft.preferredDate}
                    onChange={(event) => {
                      update("preferredDate", event.target.value);
                      if (!event.target.value) update("preferredTime", "");
                    }}
                    aria-invalid={Boolean(errors.preferredDate)}
                    data-testid="preferred-date"
                  />
                  {errors.preferredDate ? (
                    <p className="field__error">{errors.preferredDate}</p>
                  ) : null}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="preferredTime">
                    Время
                  </label>
                  <input
                    id="preferredTime"
                    type="time"
                    className="input"
                    value={draft.preferredTime}
                    onChange={(event) => update("preferredTime", event.target.value)}
                    data-testid="preferred-time"
                  />
                  <p className="field__hint">Чтобы указать время, выберите дату.</p>
                </div>
                <div className="field field--full">
                  <label className="field__label" htmlFor="comment">
                    Комментарий
                  </label>
                  <textarea
                    id="comment"
                    className="textarea"
                    value={draft.comment}
                    onChange={(event) => update("comment", event.target.value)}
                    placeholder="Домофон, пожелания к соусу, «без лука»…"
                    maxLength={1000}
                    data-testid="comment"
                  />
                  <p className="field__hint">{draft.comment.length}/1000</p>
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="form-card__head">
                <div>
                  <h2>Фотографии</h2>
                  <p>
                    Для «Своего блюда» нужно хотя бы одно фото.
                    {hasCustom ? " Это обязательно." : " Для остальных блюд — по желанию."}
                  </p>
                </div>
                <span className="form-card__num" aria-hidden="true">03</span>
              </div>
              <PhotoField
                photos={photos}
                onFiles={addFiles}
                onRemove={removePhoto}
                error={errors.photos ?? photoError}
              />
              {storageWarning ? (
                <p className="field__hint" style={{ marginTop: 8 }}>
                  Браузер не разрешил сохранить черновик. Форма продолжит работать, но
                  после перезагрузки данные могут пропасть.
                </p>
              ) : null}
            </section>

            <section className="form-card">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={draft.consent}
                  onChange={(event) => update("consent", event.target.checked)}
                  aria-invalid={Boolean(errors.consent)}
                  data-testid="consent"
                />
                <span>
                  Согласен на обработку персональных данных для выполнения заказа.{" "}
                  <Link href="/privacy" target="_blank">
                    Политика конфиденциальности
                  </Link>
                  . <span className="tiny muted">Без согласия заказ не принимается.</span>
                </span>
              </label>
              {errors.consent ? <p className="field__error">{errors.consent}</p> : null}
            </section>

            {formError ? (
              <div className="form-alert" role="alert" ref={errorRef} data-testid="checkout-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5M12 7.5v.2" />
                </svg>
                <span>{formError}</span>
              </div>
            ) : null}
          </div>

          <aside className="checkout-summary" aria-label="Итог заказа">
            <div className="form-card__head" style={{ marginBottom: 0 }}>
              <div>
                <h2>Ваш заказ</h2>
                <p>
                  {lines.length} {lines.length === 1 ? "позиция" : "позиции"} · изменили
                  меню?{" "}
                  <button
                    type="button"
                    className="text-link"
                    style={{ background: "none", border: 0, padding: 0, font: "inherit" }}
                    onClick={openCart}
                  >
                    Открыть корзину
                  </button>
                </p>
              </div>
            </div>

            <div className="summary-lines">
              {calculation.lines.map((line) => (
                <div
                  className={`summary-line${line.quote ? " summary-line--quote" : ""}`}
                  key={line.key}
                >
                  <span>
                    {line.name} × {line.qty}
                    <br />
                    <span className="tiny muted">
                      {line.variantLabel}
                      {line.optionLabels.length > 0
                        ? ` · ${line.optionLabels.join(", ")}`
                        : ""}
                    </span>
                  </span>
                  <strong>
                    {line.lineTotal !== null ? formatRub(line.lineTotal) : "По запросу"}
                  </strong>
                </div>
              ))}
            </div>

            <div className="summary-divider" />

            <div className="summary-rows">
              <div className="summary-row">
                <span>Блюда с известной ценой</span>
                <strong>{formatRub(calculation.knownFood)}</strong>
              </div>
              {calculation.minUplift > 0 ? (
                <div className="summary-row">
                  <span>Доплата до минимума</span>
                  <strong>{formatRub(calculation.minUplift)}</strong>
                </div>
              ) : null}
              {calculation.deliveryFee > 0 ? (
                <div className="summary-row">
                  <span>Доставка</span>
                  <strong>{formatRub(calculation.deliveryFee)}</strong>
                </div>
              ) : null}
              {calculation.outOfTownFee > 0 ? (
                <div className="summary-row">
                  <span>Выезд за город</span>
                  <strong>{formatRub(calculation.outOfTownFee)}</strong>
                </div>
              ) : null}
            </div>

            {calculation.hasQuote ? (
              <div className="summary-quote-note">
                В заказе есть «Своё блюдо». Его цена и минимум заказа не входят в известную
                сумму — владелец согласует их и добавит к итогу.
              </div>
            ) : null}

            <div className="summary-total">
              <span>Известная сумма</span>
              <strong data-testid="checkout-total">{formatRub(calculation.totalKnown)}</strong>
            </div>

            {calculation.knownFood > 0 && calculation.knownFood < calculation.minOrder ? (
              <div className="min-order-bar">
                <span>
                  До минимума {formatRub(calculation.minOrder - calculation.knownFood)} —
                  добавим автоматически в сумму
                </span>
                <span className="min-order-bar__track" aria-hidden="true">
                  <span
                    className="min-order-bar__fill"
                    style={{ width: `${minProgress}%` }}
                  />
                </span>
              </div>
            ) : null}

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={submitting}
              data-testid="submit-order"
            >
              {submitting ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Отправляем…
                </>
              ) : (
                "Отправить заказ"
              )}
            </button>

            <p className="checkout-aside-note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Заказ не оплачивается онлайн. Владелец подтвердит сумму и время, после чего
              статус обновится на приватной странице.
            </p>
          </aside>
        </form>
      </main>
      <SiteFooter company={company} />
      <CartDrawer pricing={pricing} />
    </>
  );
}
