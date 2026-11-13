"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useCart } from "@/components/cart/CartProvider";
import { FoodGlyph } from "@/components/site/FoodGlyph";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { HeroStage } from "@/components/three/HeroStage";
import {
  CATEGORIES,
  getCategory,
  getCategoryItems,
  getItem,
  makeLineKey,
  OPTION_HINTS,
  OPTION_LABELS,
  type CategoryId,
  type OptionId,
  type VariantId,
} from "@/lib/menu";
import {
  priceLine,
  type CartLineInput,
  type PricingSettings,
} from "@/lib/pricing";
import { formatRub, formatPhone } from "@/lib/format";
import type { AppSettings } from "@/lib/settings";

export function LandingPage({ settings }: { settings: AppSettings }) {
  const { pricing, company, character } = settings;
  const { addItem, openCart } = useCart();
  const [activeCategory, setActiveCategory] = useState<CategoryId>("burgers");
  const [selectedId, setSelectedId] = useState("b-boxy");
  const [variant, setVariant] = useState<VariantId>("standard");
  const [options, setOptions] = useState<OptionId[]>([]);
  const [qty, setQty] = useState(1);
  const [customDescription, setCustomDescription] = useState("");
  const [added, setAdded] = useState(false);

  const category = getCategory(activeCategory) ?? CATEGORIES[0]!;
  const selected = getItem(selectedId) ?? getCategoryItems(activeCategory)[0]!;
  const items = getCategoryItems(activeCategory);

  const configLine = useMemo<CartLineInput>(
    () => ({
      key:
        selected.isCustom
          ? "custom:single:"
          : makeLineKey(selected.id, variant, options),
      itemId: selected.id,
      variant: selected.isCustom ? "single" : variant,
      qty: selected.isCustom ? 1 : qty,
      options: selected.isCustom ? [] : options,
      customDescription: selected.isCustom ? customDescription : undefined,
    }),
    [selected, variant, options, qty, customDescription],
  );

  const priced = useMemo(
    () => priceLine(configLine, pricing),
    [configLine, pricing],
  );

  const selectCategory = (id: CategoryId) => {
    const nextCategory = getCategory(id);
    if (!nextCategory) return;
    setActiveCategory(id);
    const first = getCategoryItems(id)[0];
    if (first) {
      setSelectedId(first.id);
      setVariant(id === "custom" ? "single" : (nextCategory.variants[0] ?? "standard"));
      setOptions([]);
      setQty(1);
    }
    setAdded(false);
  };

  const selectItem = (id: string) => {
    const item = getItem(id);
    if (!item) return;
    setSelectedId(id);
    const itemCategory = getCategory(item.categoryId);
    setActiveCategory(item.categoryId);
    setVariant(
      item.isCustom ? "single" : (itemCategory?.variants[0] ?? "standard"),
    );
    setOptions([]);
    setQty(1);
    setAdded(false);
  };

  const toggleOption = (option: OptionId) => {
    setOptions((current) =>
      current.includes(option)
        ? current.filter((entry) => entry !== option)
        : [...current, option],
    );
    setAdded(false);
  };

  const customValid =
    !selected.isCustom || customDescription.trim().length >= 10;
  const available = priced !== null && (priced.basePrice !== null || priced.quote);
  const canAdd = available && customValid;

  const addToCart = () => {
    if (!canAdd) return;
    addItem({
      ...configLine,
      customDescription: selected.isCustom
        ? customDescription.trim()
        : undefined,
    });
    setAdded(true);
    setQty(1);
    if (selected.isCustom) setCustomDescription("");
    window.setTimeout(() => setAdded(false), 2400);
  };

  const priceLabel =
    priced && priced.unitPrice !== null
      ? formatRub(priced.unitPrice)
      : "По запросу";

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="hero">
          <div className="page hero__grid">
            <div className="hero__copy">
              <span className="hero__badge">
                <span className="hero__badge-dot" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                Демо-кафе · {company.city} · заказ без звонка
              </span>
              <h1>
                Горячо.
                <br />
                Быстро.
                <br />
                <em>По-соседски.</em>
              </h1>
              <p className="hero__lead">
                Бургеры, шаурма и пицца с понятным составом. Соберите заказ, приложите
                фото для своего блюда и получите приватную ссылку со статусом — без
                регистрации и лишних звонков.
              </p>
              <div className="hero__actions">
                <Link href="#menu" className="btn btn--primary">
                  Собрать заказ
                  <svg className="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <Link href="#how" className="btn btn--ghost">
                  Как это работает
                </Link>
              </div>
              <div className="hero__facts">
                <span className="hero__fact">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  Готовим 12–18 минут
                </span>
                <span className="hero__fact">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
                    <circle cx="7" cy="18" r="1.4" />
                    <circle cx="17" cy="18" r="1.4" />
                  </svg>
                  Доставка от {formatRub(pricing.deliveryFee)}
                </span>
                <span className="hero__fact">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
                    <circle cx="12" cy="10" r="2.4" />
                  </svg>
                  Самовывоз без ожидания в очереди
                </span>
              </div>
            </div>

            <div className="hero-art" aria-label="Иллюстрация бренда">
              <div className="hero-art__frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/poster.svg"
                  alt="Боксик — персонаж-коробка — держит бургер и картошку"
                  className="hero-art__image"
                />
              </div>
              <div className="hero-chip hero-chip--top">
                <span className="hero-chip__row">
                  <span className="hero-chip__dot" aria-hidden="true" />
                  Кухня на связи
                </span>
                <strong>12–18 мин</strong>
                <span>среднее время сборки</span>
              </div>
              <div className="hero-chip hero-chip--bottom">
                <span className="hero-chip__row">
                  <span className="hero-chip__dot" aria-hidden="true" />
                  Бонус после заказа
                </span>
                <strong>{formatRub(settings.game.bonusAmount)}</strong>
                <span>за игру «Чистый поднос»</span>
              </div>
            </div>
          </div>

          <div className="hero-marquee" aria-hidden="true">
            <div className="hero-marquee__track">
              <span>Свежая котлета</span>
              <span>Свой соус</span>
              <span>Фото своего блюда</span>
              <span>Приватная ссылка</span>
              <span>Бонус за игру</span>
            </div>
            <div className="hero-marquee__track">
              <span>Свежая котлета</span>
              <span>Свой соус</span>
              <span>Фото своего блюда</span>
              <span>Приватная ссылка</span>
              <span>Бонус за игру</span>
            </div>
          </div>
        </section>

        <section className="section menu-section" id="menu">
          <div className="page">
            <div className="section-head section-head--split">
              <div>
                <span className="eyebrow">Меню и конструктор</span>
                <h2>Соберите свой бокс</h2>
                <p className="lead" style={{ marginTop: 10 }}>
                  Выберите категорию, размер и добавки. Сумма пересчитывается сразу,
                  а итоговую цену и время подтверждает кухня.
                </p>
              </div>
              <button type="button" className="btn btn--ghost btn--small" onClick={openCart}>
                Открыть корзину
              </button>
            </div>

            <div className="menu-tabs" role="tablist" aria-label="Категории меню">
              {CATEGORIES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  className="menu-tab"
                  aria-selected={entry.id === activeCategory}
                  aria-controls="menu-panel"
                  onClick={() => selectCategory(entry.id)}
                  data-testid={`menu-tab-${entry.id}`}
                >
                  {entry.shortTitle}
                  <span className="menu-tab__count">{getCategoryItems(entry.id).length}</span>
                </button>
              ))}
            </div>
            <p className="menu-category-note">
              <span aria-hidden="true">✳</span>
              {category.description}
              {category.note ? ` ${category.note}` : ""}
            </p>

            <div
              className="menu-layout"
              id="menu-panel"
              role="tabpanel"
              aria-label={category.title}
            >
              <div className="menu-list">
                {items.map((item) => {
                  const itemCategory = getCategory(item.categoryId);
                  const prices = pricing.items[item.id];
                  const variants = itemCategory?.variants ?? ["standard"];
                  const availablePrices = variants
                    .map((entry) =>
                      entry === "single"
                        ? prices?.single
                        : entry === "large"
                          ? prices?.large
                          : prices?.standard,
                    )
                    .filter((value): value is number => typeof value === "number");
                  const fromPrice = availablePrices.length
                    ? Math.min(...availablePrices)
                    : null;
                  const tint =
                    item.categoryId === "burgers"
                      ? "rgba(217,75,43,0.12)"
                      : item.categoryId === "pizza"
                        ? "rgba(232,179,74,0.2)"
                        : item.categoryId === "drinks"
                          ? "rgba(119,138,99,0.16)"
                          : item.categoryId === "desserts"
                            ? "rgba(233,167,160,0.22)"
                            : item.categoryId === "custom"
                              ? "rgba(37,30,23,0.09)"
                              : "rgba(232,179,74,0.14)";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="item-card"
                      aria-pressed={selected.id === item.id}
                      onClick={() => selectItem(item.id)}
                      data-testid={`item-${item.id}`}
                    >
                      <span className="item-card__top">
                        <span
                          className="item-card__art"
                          style={{ background: tint, color: "var(--ink)" }}
                          aria-hidden="true"
                        >
                          <FoodGlyph kind={item.model} />
                        </span>
                        <span className="item-card__tags">
                          {(item.tags ?? []).map((tag) => (
                            <span
                              key={tag}
                              className={
                                tag === "хит"
                                  ? "tag tag--accent"
                                  : tag === "веган" || tag === "веган-опция"
                                    ? "tag tag--sage"
                                    : "tag"
                              }
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      </span>
                      <span className="item-card__name">{item.name}</span>
                      <span className="item-card__desc">{item.description}</span>
                      <span className="item-card__foot">
                        <span className="item-card__price">
                          {item.isCustom
                            ? "По запросу"
                            : fromPrice !== null
                              ? `от ${formatRub(fromPrice)}`
                              : "Недоступно"}
                          {!item.isCustom && fromPrice !== null ? (
                            <small> · {itemCategory?.variantLabels[variants[0]!]}</small>
                          ) : null}
                        </span>
                        <span className="item-card__add" aria-hidden="true">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <aside className="configurator" aria-label="Настройка выбранного блюда">
                <HeroStage
                  item={selected}
                  category={selected.categoryId}
                  price={priced?.unitPrice ?? null}
                  character={character}
                  accent={company.accent}
                />

                <div className="config__head">
                  <div className="config__title">
                    <h3>{selected.name}</h3>
                    <p>{selected.description}</p>
                  </div>
                  <div className="config__price">
                    {priceLabel}
                    <small>{selected.isCustom ? "после согласования" : "за порцию"}</small>
                  </div>
                </div>

                {!selected.isCustom ? (
                  <>
                    <div className="config__group">
                      <span className="config__label">
                        Размер
                        <span className="tiny muted">
                          {category.variantLabels[variant] ?? ""}
                        </span>
                      </span>
                      <div className="segmented" role="group" aria-label="Размер порции">
                        {(getCategory(selected.categoryId)?.variants ?? ["standard"]).map(
                          (entry) => (
                            <button
                              key={entry}
                              type="button"
                              aria-pressed={variant === entry}
                              onClick={() => {
                                setVariant(entry);
                                setAdded(false);
                              }}
                            >
                              {getCategory(selected.categoryId)?.variantLabels[entry] ?? entry}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {selected.options.length > 0 ? (
                      <div className="config__group">
                        <span className="config__label">Добавки</span>
                        {selected.options.map((option) => {
                          const active = options.includes(option);
                          const percent =
                            option === "double"
                              ? pricing.doublePercent
                              : pricing.secondSaucePercent;
                          return (
                            <button
                              key={option}
                              type="button"
                              className="option-toggle"
                              aria-pressed={active}
                              onClick={() => toggleOption(option)}
                              data-testid={`option-${option}`}
                            >
                              <span className="option-toggle__box" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                                  <path d="m5 12 4 4L19 6" />
                                </svg>
                              </span>
                              <span className="option-toggle__text">
                                <strong>
                                  {OPTION_LABELS[option]} · +{percent}%
                                </strong>
                                <span>{OPTION_HINTS[option]}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="config__group">
                    <label className="config__label" htmlFor="custom-description">
                      Что приготовить?
                      <span className="tiny muted">
                        {customDescription.trim().length}/10
                      </span>
                    </label>
                    <textarea
                      id="custom-description"
                      className="config__custom"
                      value={customDescription}
                      onChange={(event) => {
                        setCustomDescription(event.target.value.slice(0, 600));
                        setAdded(false);
                      }}
                      placeholder="Например: большая шаурма без лука, с курицей и острым соусом, разрезать пополам. Или бургер с двумя котлетами и без сыра."
                      aria-describedby="custom-hint"
                      data-testid="custom-description"
                    />
                    <div className="config__note" id="custom-hint">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 11v5M12 7.5v.2" />
                      </svg>
                      <span>
                        Для своего блюда нужно описание от 10 символов и хотя бы одно фото
                        на оформлении. Цену согласуем после просмотра.
                      </span>
                    </div>
                  </div>
                )}

                <div className="config__foot">
                  {!selected.isCustom ? (
                    <div className="stepper" aria-label="Количество">
                      <button
                        type="button"
                        onClick={() => setQty((value) => Math.max(1, value - 1))}
                        disabled={qty <= 1}
                        aria-label="Уменьшить количество"
                      >
                        −
                      </button>
                      <output>{qty}</output>
                      <button
                        type="button"
                        onClick={() => setQty((value) => Math.min(50, value + 1))}
                        disabled={qty >= 50}
                        aria-label="Увеличить количество"
                      >
                        +
                      </button>
                    </div>
                  ) : null}
                  <div className="config__total">
                    <small>{selected.isCustom ? "Стоимость" : "Итого за позицию"}</small>
                    <strong>
                      {priced?.lineTotal !== null && priced
                        ? formatRub(priced.lineTotal)
                        : "По запросу"}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={addToCart}
                    disabled={!canAdd}
                    data-testid="add-to-cart"
                  >
                    {added ? "Добавлено" : selected.isCustom ? "Добавить и обсудить" : "В корзину"}
                  </button>
                </div>

                {priced === null ? (
                  <div className="config__note">
                    <span>
                      Похоже, это блюдо сейчас недоступно. Загляните в другую категорию.
                    </span>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </section>

        <section className="section section--tight" id="how">
          <div className="page">
            <div className="section-head">
              <span className="eyebrow">Как заказать</span>
              <h2>Три шага без регистрации</h2>
            </div>
            <div className="steps">
              <article className="step-card">
                <span className="step-card__num">01</span>
                <h3>Соберите бокс</h3>
                <p>
                  Выберите блюда, размер и добавки. Корзина сохраняется, даже если вы
                  случайно обновите страницу.
                </p>
              </article>
              <article className="step-card">
                <span className="step-card__num">02</span>
                <h3>Оставьте детали</h3>
                <p>
                  Укажите имя, телефон и адрес или самовывоз. Для своего блюда приложите
                  до трёх фото-референсов.
                </p>
              </article>
              <article className="step-card">
                <span className="step-card__num">03</span>
                <h3>Следите по ссылке</h3>
                <p>
                  После отправки появится приватная ссылка. По ней видно статус, сумму и
                  согласованное время — обновляется без перезагрузки.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--tight" id="about">
          <div className="page">
            <div className="feature-band">
              <div className="feature-band__copy">
                <span className="eyebrow">О кафе</span>
                <h2>Маленькая кухня с большим вниманием к деталям</h2>
                <p>
                  {company.description} Это демонстрационный проект: реальные заказы не
                  принимаются, а контакты и адрес — пример для портфолио.
                </p>
                <ul className="feature-band__list">
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                    Понятная цена до отправки: надбавки считаются сразу.
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                    Своё блюдо — по запросу, без выдуманной цены.
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                    Приватная ссылка: заказ не найдётся по номеру телефона.
                  </li>
                </ul>
              </div>
              <div className="feature-band__visual">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/boxy.svg" alt="Боксик держит поднос" />
                <div className="feature-band__stamp">
                  <span>Персонаж</span>
                  <strong>{character.name}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--tight">
          <div className="page">
            <div className="faq-grid">
              <div className="section-head" style={{ marginBottom: 0 }}>
                <span className="eyebrow">Вопросы</span>
                <h2>Коротко о важном</h2>
                <p className="lead">
                  Если что-то осталось непонятным, напишите или позвоните — контакты
                  ниже.
                </p>
                <Link href="/contacts" className="text-link">
                  Все контакты
                </Link>
              </div>
              <div className="faq-list">
                <details className="faq-item" open>
                  <summary>Как считается цена?</summary>
                  <p>
                    Базовая цена размера плюс процент за двойную начинку и второй соус.
                    Каждая надбавка округляется до целого рубля. Доставка и выезд за город
                    добавляются отдельно, а минимальная сумма считается только по блюдам
                    с известной ценой.
                  </p>
                </details>
                <details className="faq-item">
                  <summary>Почему «Своё блюдо» без цены?</summary>
                  <p>
                    Мы не знаем состав заранее, поэтому не показываем выдуманную сумму.
                    Опишите идею, приложите фото — владелец посмотрит и согласует цену и
                    время. Такая позиция не входит в известную сумму и минимум заказа.
                  </p>
                </details>
                <details className="faq-item">
                  <summary>Что происходит после отправки?</summary>
                  <p>
                    Заказ сохраняется в базе, вы попадаете на приватную страницу с
                    непредсказуемой ссылкой. Владелец подтверждает итоговую цену и время,
                    и они появляются на этой же странице.
                  </p>
                </details>
                <details className="faq-item">
                  <summary>Можно ли оплатить бонусом сразу?</summary>
                  <p>
                    Нет. Бонус за игру действует на следующий заказ, а не на текущий.
                    Код активирует владелец вручную — это демонстрационная механика без
                    онлайн-платежей.
                  </p>
                </details>
                <details className="faq-item">
                  <summary>Что с фотографиями?</summary>
                  <p>
                    Принимаем JPEG, PNG и WebP до 8 МБ, не больше трёх штук. Сервер
                    проверяет реальный формат, сжимает изображение и хранит его в базе.
                    Фото доступны только по приватной ссылке заказа или в кабинете
                    владельца.
                  </p>
                </details>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--tight" id="contacts">
          <div className="page">
            <div className="contact-band">
              <div className="contact-band__grid">
                <div>
                  <span className="eyebrow">Контакты</span>
                  <h2>Заходите на огонёк или заказывайте домой</h2>
                  <p>
                    {company.deliveryArea}. {company.workingHours}. Это демо-адрес и
                    демо-телефон: перед реальным запуском замените их в кабинете
                    владельца.
                  </p>
                  <div className="hero__actions" style={{ marginTop: 18 }}>
                    <Link href="#menu" className="btn btn--primary">
                      В меню
                    </Link>
                    <Link href="/contacts" className="btn btn--ghost" style={{ color: "var(--bg)", borderColor: "color-mix(in srgb, var(--bg) 34%, transparent)" }}>
                      Контакты и схема
                    </Link>
                  </div>
                </div>
                <div className="contact-band__details">
                  <div className="contact-band__row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
                      <circle cx="12" cy="10" r="2.4" />
                    </svg>
                    <span>
                      <small>Адрес</small>
                      {company.address}
                    </span>
                  </div>
                  <div className="contact-band__row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" />
                    </svg>
                    <span>
                      <small>Телефон</small>
                      {company.phone ? (
                        <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>
                          {formatPhone(company.phone)}
                        </a>
                      ) : (
                        "Уточняется в демо"
                      )}
                    </span>
                  </div>
                  <div className="contact-band__row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                    <span>
                      <small>Почта</small>
                      <a href={`mailto:${company.email}`}>{company.email}</a>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter company={company} />
      <CartDrawer pricing={pricing} />
    </>
  );
}
