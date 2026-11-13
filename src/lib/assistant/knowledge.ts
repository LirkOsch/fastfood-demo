import {
  CATEGORIES,
  getCategory,
  getCategoryItems,
  getItem,
  MENU_ITEMS,
  makeLineKey,
  type CategoryId,
  type MenuItem,
  type OptionId,
  type VariantId,
} from "@/lib/menu";
import { itemBasePrice, type CartLineInput, type PricingSettings } from "@/lib/pricing";
import { formatRub } from "@/lib/format";

/**
 * Знания помощника — чистые функции без доступа к БД.
 * Цены берутся только из PricingSettings, поэтому помощник не может выдумать сумму.
 */

const CATEGORY_STEMS = ["бургер", "шаурм", "пицц", "закуск", "напит", "десерт", "сладк"];

/** Синонимы, по которым гости называют позиции меню. */
const ALIASES: Record<string, string[]> = {
  "b-boxy": ["боксик", "фирменный бургер", "теплый бургер"],
  "b-chicken": ["чикен", "чикинг", "куриный бургер"],
  "b-double": ["дабл", "смэш", "двойной бургер"],
  "b-green": ["зеленый бокс", "зеленый бургер", "котлета из нута"],
  "s-classic": ["классик", "классическая шаурма"],
  "s-spicy": ["остряк", "острая шаурма", "шаурма с чили", "халапеньо"],
  "s-cheese": ["сырная шаурма", "шаурма с сыром"],
  "p-margherita": ["маргарита", "маргарит"],
  "p-pepperoni": ["пепперони", "пеперони"],
  "p-chicken": ["сырный цыпленок", "цыпленок", "куриная пицца"],
  "k-fries": ["фри", "картошка", "картофель"],
  "k-nuggets": ["наггетс", "наггетсы", "наггет"],
  "k-onion": ["кольца", "луковые кольца"],
  "d-lemonade": ["лимонад"],
  "d-cola": ["кола", "колу", "пепси"],
  "d-shake": ["коктейль", "шейк", "молочный коктейль"],
  "t-donut": ["донат", "пончик"],
  "t-icecream": ["мороженое", "мороженка", "пломбир"],
  "t-cookie": ["печенье", "печенка"],
};

const SUFFIXES = [
  "иями",
  "ями",
  "ами",
  "ого",
  "его",
  "ому",
  "ему",
  "ыми",
  "ими",
  "ов",
  "ев",
  "ый",
  "ий",
  "ой",
  "ая",
  "ое",
  "ые",
  "ие",
  "ую",
  "юю",
  "ых",
  "их",
  "ом",
  "ем",
  "ам",
  "ям",
  "ах",
  "ях",
  "ия",
  "ии",
  "й",
  "ь",
  "а",
  "я",
  "ы",
  "и",
  "о",
  "е",
  "у",
  "ю",
];

/** Грубое, но предсказуемое отсечение падежных окончаний. */
export function stem(word: string): string {
  for (const suffix of SUFFIXES) {
    if (word.length - suffix.length >= 3 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

const ITEM_NAME_STEMS: string[][] = MENU_ITEMS.map((item) =>
  tokenize(item.name)
    .filter((token) => token.length >= 3 && !CATEGORY_STEMS.includes(stem(token)))
    .map(stem),
);

const NAME_FREQUENCY = new Map<string, number>();
for (const stems of ITEM_NAME_STEMS) {
  for (const value of new Set(stems)) {
    NAME_FREQUENCY.set(value, (NAME_FREQUENCY.get(value) ?? 0) + 1);
  }
}

function weightFor(tokenStem: string): number {
  const frequency = NAME_FREQUENCY.get(tokenStem) ?? 1;
  if (frequency <= 1) return 6;
  if (frequency === 2) return 4;
  return 2;
}

export interface ItemMatch {
  item: MenuItem;
  score: number;
}

function countMatchingStems(nameStems: string[], queryStems: Set<string>): number {
  let score = 0;
  for (const value of new Set(nameStems)) {
    if (queryStems.has(value)) score += weightFor(value);
  }
  return score;
}

function aliasMatches(alias: string, queryStems: Set<string>): boolean {
  const aliasStems = tokenize(alias).map(stem);
  return aliasStems.length > 0 && aliasStems.every((value) => queryStems.has(value));
}

/** Ищет позиции меню, о которых спрашивает гость. */
export function matchMenuItems(message: string, limit = 4): ItemMatch[] {
  const queryStems = new Set(tokenize(message).map(stem));
  const matches: ItemMatch[] = [];
  MENU_ITEMS.forEach((item, index) => {
    if (item.isCustom) return;
    let score = countMatchingStems(ITEM_NAME_STEMS[index] ?? [], queryStems);
    for (const alias of ALIASES[item.id] ?? []) {
      if (aliasMatches(alias, queryStems)) score += 5;
    }
    if (score > 0) matches.push({ item, score });
  });
  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function detectCategory(message: string): CategoryId | null {
  const normalized = normalizeText(message);
  const stems = new Set(tokenize(message).map(stem));
  const has = (word: string) => stems.has(stem(word)) || normalized.includes(normalizeText(word));

  if (normalized.includes("свое блюдо") || normalized.includes("свое блюд")) return "custom";
  if (has("бургер")) return "burgers";
  if (has("шаурма") || has("шаверма")) return "shawarma";
  if (has("пицца")) return "pizza";
  if (has("закуска") || has("картошка") || has("наггетсы") || has("фри")) return "snacks";
  if (has("напиток") || has("напитки") || has("попить") || has("лимонад") || has("кола") || has("коктейль")) {
    return "drinks";
  }
  if (has("десерт") || has("сладкое") || has("донат") || has("мороженое") || has("печенье")) {
    return "desserts";
  }
  return null;
}

export interface VariantPrice {
  variant: VariantId;
  label: string;
  price: number;
}

/** Доступные варианты позиции с ценой из настроек. Пустой массив — позиция недоступна. */
export function variantPrices(item: MenuItem, pricing: PricingSettings): VariantPrice[] {
  if (item.isCustom) return [];
  const category = getCategory(item.categoryId);
  const variants = category?.variants ?? [];
  const result: VariantPrice[] = [];
  for (const variant of variants) {
    const price = itemBasePrice(item.id, variant, pricing);
    if (price !== null) {
      result.push({
        variant,
        label: category?.variantLabels[variant] ?? variant,
        price,
      });
    }
  }
  return result;
}

function pricePart(entry: VariantPrice): string {
  const label = entry.label === "Порция" || entry.label === "На заказ" ? "" : `${entry.label} `;
  return `${label}${formatRub(entry.price)}`;
}

/** «Стандарт 349 ₽, Большой 449 ₽» или «сейчас недоступно». */
export function priceSummary(item: MenuItem, pricing: PricingSettings): string {
  if (item.isCustom) return "по запросу";
  const prices = variantPrices(item, pricing);
  if (prices.length === 0) return "сейчас недоступно";
  return prices.map(pricePart).join(", ");
}

export function priceLines(item: MenuItem, pricing: PricingSettings): string[] {
  const prices = variantPrices(item, pricing);
  if (prices.length === 0) return [];
  return prices.map((entry) => `${entry.label} — ${formatRub(entry.price)}`);
}

export function optionNote(item: MenuItem, pricing: PricingSettings): string | null {
  if (item.isCustom) return null;
  const parts: string[] = [];
  if (item.options.includes("double")) {
    parts.push(`двойная начинка +${pricing.doublePercent}%`);
  }
  if (item.options.includes("sauce")) {
    parts.push(`второй соус +${pricing.secondSaucePercent}%`);
  }
  if (parts.length === 0) return null;
  return `Можно добавить: ${parts.join(", ")}. Точная сумма видна в корзине.`;
}

export function defaultVariant(
  item: MenuItem,
  pricing: PricingSettings,
): VariantPrice | null {
  const prices = variantPrices(item, pricing);
  if (prices.length === 0) return null;
  return (
    prices.find((entry) => entry.variant === "standard") ??
    prices.find((entry) => entry.variant === "single") ??
    prices[0]!
  );
}

/** Готовая строка корзины для действия «добавить». */
export function buildAddLine(
  item: MenuItem,
  pricing: PricingSettings,
  options: OptionId[] = [],
): CartLineInput | null {
  if (item.isCustom) return null;
  const variant = defaultVariant(item, pricing);
  if (!variant) return null;
  const allowed = options.filter((option) => item.options.includes(option));
  return {
    key: makeLineKey(item.id, variant.variant, allowed),
    itemId: item.id,
    variant: variant.variant,
    qty: 1,
    options: allowed,
  };
}

/** Строки обзора меню: «Бургеры (от 329 ₽): …». */
export function menuCategoryLines(pricing: PricingSettings): string[] {
  const lines: string[] = [];
  for (const category of CATEGORIES) {
    if (category.id === "custom") continue;
    const available = getCategoryItems(category.id).filter(
      (item) => variantPrices(item, pricing).length > 0,
    );
    if (available.length === 0) continue;
    const prices = available.flatMap((item) =>
      variantPrices(item, pricing).map((entry) => entry.price),
    );
    const from = Math.min(...prices);
    lines.push(`${category.title} (от ${formatRub(from)}): ${available.map((item) => item.name).join(", ")}`);
  }
  return lines;
}

/** Позиции одной категории с ценами. */
export function categoryItemLines(
  categoryId: CategoryId,
  pricing: PricingSettings,
): string[] {
  return getCategoryItems(categoryId)
    .map((item) => {
      const prices = variantPrices(item, pricing);
      if (prices.length === 0) return null;
      return `${item.name} — ${prices.map(pricePart).join(", ")}`;
    })
    .filter((line): line is string => line !== null);
}

export function availableItemsByIds(
  ids: string[],
  pricing: PricingSettings,
): MenuItem[] {
  const result: MenuItem[] = [];
  for (const id of ids) {
    const item = getItem(id);
    if (item && variantPrices(item, pricing).length > 0) result.push(item);
  }
  return result;
}

export function itemsByTag(tag: string, pricing: PricingSettings): MenuItem[] {
  return MENU_ITEMS.filter(
    (item) =>
      !item.isCustom &&
      item.tags?.includes(tag) &&
      variantPrices(item, pricing).length > 0,
  );
}

export function cheapestVariantPrice(item: MenuItem, pricing: PricingSettings): number | null {
  const prices = variantPrices(item, pricing);
  if (prices.length === 0) return null;
  return Math.min(...prices.map((entry) => entry.price));
}

const TOKEN_IN_LINK = /\/order\/([A-Za-z0-9_-]{16,64})/;
const RAW_TOKEN = /\b([A-Za-z0-9_-]{32})\b/;
const ORDER_NUMBER = /\bTB-\d{6}-[A-Z0-9]{4}\b/i;

/** Достаёт токен из ссылки /order/… или из «сырого» текста. */
export function extractOrderToken(message: string): string | null {
  const fromLink = message.match(TOKEN_IN_LINK);
  if (fromLink?.[1]) return fromLink[1];
  const raw = message.match(RAW_TOKEN);
  return raw?.[1] ?? null;
}

export function extractOrderNumber(message: string): string | null {
  const match = message.match(ORDER_NUMBER);
  return match ? match[0].toUpperCase() : null;
}

export function isOrderStatusQuestion(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized.includes("статус") ||
    normalized.includes("где заказ") ||
    normalized.includes("где мой заказ") ||
    normalized.includes("готов ли заказ") ||
    normalized.includes("готов ли мой заказ") ||
    normalized.includes("что с заказом") ||
    normalized.includes("отследить заказ")
  );
}
