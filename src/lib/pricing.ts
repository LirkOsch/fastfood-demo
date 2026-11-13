import {
  getCategory,
  getItem,
  getVariantLabel,
  MENU_ITEMS,
  OPTION_LABELS,
  type CategoryId,
  type OptionId,
  type VariantId,
} from "./menu";

export interface ItemPrice {
  standard?: number;
  large?: number;
  single?: number;
  available: boolean;
}

export interface PricingSettings {
  version: number;
  items: Record<string, ItemPrice>;
  minOrder: number;
  deliveryFee: number;
  outOfTownFee: number;
  doublePercent: number;
  secondSaucePercent: number;
}

export interface CartLineInput {
  key: string;
  itemId: string;
  variant: VariantId;
  qty: number;
  options: OptionId[];
  customDescription?: string;
}

export interface PricedLine {
  key: string;
  itemId: string;
  categoryId: CategoryId;
  name: string;
  description: string;
  variant: VariantId;
  variantLabel: string;
  qty: number;
  options: OptionId[];
  optionLabels: string[];
  quote: boolean;
  customDescription?: string;
  basePrice: number | null;
  doubleFee: number;
  sauceFee: number;
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface OrderContext {
  deliveryMethod: "delivery" | "pickup";
  outOfTown: boolean;
}

export interface Calculation {
  lines: PricedLine[];
  knownFood: number;
  minOrder: number;
  minUplift: number;
  foodCharged: number;
  deliveryFee: number;
  outOfTownFee: number;
  totalKnown: number;
  hasQuote: boolean;
  quoteCount: number;
  quoteItems: string[];
  invalidKeys: string[];
  currency: "RUB";
  percentRule: string;
}

export const DEFAULT_PRICING: PricingSettings = {
  version: 1,
  items: {
    "b-boxy": { standard: 349, large: 449, available: true },
    "b-chicken": { standard: 329, large: 429, available: true },
    "b-double": { standard: 449, large: 549, available: true },
    "b-green": { standard: 359, large: 459, available: true },
    "s-classic": { standard: 299, large: 389, available: true },
    "s-spicy": { standard: 319, large: 409, available: true },
    "s-cheese": { standard: 339, large: 429, available: true },
    "p-margherita": { standard: 399, large: 599, available: true },
    "p-pepperoni": { standard: 449, large: 649, available: true },
    "p-chicken": { standard: 469, large: 669, available: true },
    "k-fries": { standard: 149, large: 229, available: true },
    "k-nuggets": { standard: 199, large: 299, available: true },
    "k-onion": { standard: 179, large: 269, available: true },
    "d-lemonade": { standard: 129, large: 179, available: true },
    "d-cola": { standard: 139, large: 189, available: true },
    "d-shake": { standard: 219, large: 279, available: true },
    "t-donut": { single: 149, available: true },
    "t-icecream": { single: 129, available: true },
    "t-cookie": { single: 99, available: true },
    custom: { single: 0, available: true },
  },
  minOrder: 500,
  deliveryFee: 149,
  outOfTownFee: 300,
  doublePercent: 35,
  secondSaucePercent: 15,
};

export const PERCENT_RULE =
  "Базовая цена варианта + процент за двойную начинку + процент за второй соус; " +
  "каждая надбавка округляется до целого рубля. Минимум считается по известной сумме блюд, " +
  "доставка и выезд за город добавляются отдельно.";

export function itemBasePrice(
  itemId: string,
  variant: VariantId,
  pricing: PricingSettings,
): number | null {
  const item = getItem(itemId);
  if (!item || item.isCustom) return null;
  const settings = pricing.items[itemId];
  if (!settings?.available) return null;
  const value =
    variant === "single"
      ? settings.single
      : variant === "large"
        ? settings.large
        : settings.standard;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null;
}

export function priceLine(
  line: CartLineInput,
  pricing: PricingSettings,
): PricedLine | null {
  const item = getItem(line.itemId);
  if (!item) return null;
  const category = getCategory(item.categoryId);
  if (!category) return null;
  const quote = Boolean(item.isCustom);
  const options = quote
    ? []
    : [...new Set(line.options)].filter((option) => item.options.includes(option));
  const base = quote ? null : itemBasePrice(item.id, line.variant, pricing);
  if (!quote && base === null) return null;

  const doubleFee =
    base !== null && options.includes("double")
      ? Math.round((base * clampPercent(pricing.doublePercent)) / 100)
      : 0;
  const sauceFee =
    base !== null && options.includes("sauce")
      ? Math.round((base * clampPercent(pricing.secondSaucePercent)) / 100)
      : 0;
  const unitPrice = base === null ? null : base + doubleFee + sauceFee;
  const qty = quote ? 1 : Math.max(1, Math.min(50, Math.trunc(line.qty) || 1));
  const lineTotal = unitPrice === null ? null : unitPrice * qty;

  return {
    key: line.key,
    itemId: item.id,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    variant: line.variant,
    variantLabel: getVariantLabel(item.categoryId, line.variant),
    qty,
    options,
    optionLabels: options.map((option) => OPTION_LABELS[option]),
    quote,
    customDescription: quote ? (line.customDescription ?? "").trim() : undefined,
    basePrice: base,
    doubleFee,
    sauceFee,
    unitPrice,
    lineTotal,
  };
}

export function calculateOrder(
  lines: CartLineInput[],
  pricing: PricingSettings,
  context: OrderContext,
): Calculation {
  const priced: PricedLine[] = [];
  const invalidKeys: string[] = [];

  for (const line of lines) {
    const result = priceLine(line, pricing);
    if (!result) {
      invalidKeys.push(line.key);
      continue;
    }
    priced.push(result);
  }

  const knownLines = priced.filter((line) => !line.quote && line.lineTotal !== null);
  const knownFood = knownLines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const minOrder = Math.max(0, Math.round(pricing.minOrder));
  const minUplift =
    knownFood > 0 && knownFood < minOrder ? Math.max(0, minOrder - knownFood) : 0;
  const foodCharged = knownFood + minUplift;
  const deliveryFee =
    context.deliveryMethod === "delivery" ? Math.max(0, Math.round(pricing.deliveryFee)) : 0;
  const outOfTownFee =
    context.deliveryMethod === "delivery" && context.outOfTown
      ? Math.max(0, Math.round(pricing.outOfTownFee))
      : 0;
  const quoteLines = priced.filter((line) => line.quote);

  return {
    lines: priced,
    knownFood,
    minOrder,
    minUplift,
    foodCharged,
    deliveryFee,
    outOfTownFee,
    totalKnown: foodCharged + deliveryFee + outOfTownFee,
    hasQuote: quoteLines.length > 0,
    quoteCount: quoteLines.length,
    quoteItems: quoteLines.map((line) => line.name),
    invalidKeys,
    currency: "RUB",
    percentRule: PERCENT_RULE,
  };
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(200, Math.round(value * 100) / 100));
}

export function sanitizePricing(input: Partial<PricingSettings> | null | undefined): PricingSettings {
  const items: Record<string, ItemPrice> = {};
  for (const item of MENU_ITEMS) {
    const incoming = input?.items?.[item.id];
    const fallback = DEFAULT_PRICING.items[item.id];
    items[item.id] = {
      standard: readMoney(incoming?.standard, fallback?.standard),
      large: readMoney(incoming?.large, fallback?.large),
      single: readMoney(incoming?.single, fallback?.single),
      available:
        typeof incoming?.available === "boolean"
          ? incoming.available
          : (fallback?.available ?? true),
    };
    if (item.isCustom) {
      items[item.id] = { single: 0, available: items[item.id].available };
    }
    if (item.model === "donut") {
      delete items[item.id].standard;
      delete items[item.id].large;
    }
  }

  return {
    version:
      typeof input?.version === "number" && Number.isFinite(input.version)
        ? Math.max(1, Math.trunc(input.version))
        : DEFAULT_PRICING.version,
    items,
    minOrder: readMoney(input?.minOrder, DEFAULT_PRICING.minOrder) ?? 0,
    deliveryFee: readMoney(input?.deliveryFee, DEFAULT_PRICING.deliveryFee) ?? 0,
    outOfTownFee: readMoney(input?.outOfTownFee, DEFAULT_PRICING.outOfTownFee) ?? 0,
    doublePercent: clampPercent(input?.doublePercent ?? DEFAULT_PRICING.doublePercent),
    secondSaucePercent: clampPercent(
      input?.secondSaucePercent ?? DEFAULT_PRICING.secondSaucePercent,
    ),
  };
}

function readMoney(value: unknown, fallback: number | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return fallback;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1000000, Math.round(number)));
}
