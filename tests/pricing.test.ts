import { describe, expect, it } from "vitest";
import {
  calculateOrder,
  DEFAULT_PRICING,
  priceLine,
  sanitizePricing,
} from "@/lib/pricing";

const line = (overrides: Partial<Parameters<typeof priceLine>[0]>) => ({
  key: "line-1",
  itemId: "b-boxy",
  variant: "standard" as const,
  qty: 1,
  options: [],
  ...overrides,
});

describe("цена позиции", () => {
  it("считает базовую цену варианта", () => {
    const priced = priceLine(line({}), DEFAULT_PRICING);
    expect(priced?.basePrice).toBe(349);
    expect(priced?.unitPrice).toBe(349);
    expect(priced?.lineTotal).toBe(349);
  });

  it("добавляет двойную начинку и второй соус с округлением", () => {
    const priced = priceLine(line({ options: ["double", "sauce"] }), DEFAULT_PRICING);
    // 349 × 35% = 122,15 → 122; 349 × 15% = 52,35 → 52.
    expect(priced?.doubleFee).toBe(122);
    expect(priced?.sauceFee).toBe(52);
    expect(priced?.unitPrice).toBe(523);
  });

  it("считает большой вариант отдельно", () => {
    const priced = priceLine(line({ variant: "large", options: ["double"] }), DEFAULT_PRICING);
    // 449 × 35% = 157,15 → 157.
    expect(priced?.basePrice).toBe(449);
    expect(priced?.doubleFee).toBe(157);
    expect(priced?.unitPrice).toBe(606);
  });

  it("умножает цену на количество", () => {
    const priced = priceLine(line({ qty: 3 }), DEFAULT_PRICING);
    expect(priced?.lineTotal).toBe(1047);
  });

  it("не применяет опции к своему блюду", () => {
    const priced = priceLine(
      line({
        itemId: "custom",
        variant: "single",
        options: ["double", "sauce"],
        customDescription: "Острый бургер без булочки",
      }),
      DEFAULT_PRICING,
    );
    expect(priced?.quote).toBe(true);
    expect(priced?.options).toEqual([]);
    expect(priced?.basePrice).toBeNull();
    expect(priced?.lineTotal).toBeNull();
  });

  it("возвращает null для неизвестной позиции", () => {
    expect(priceLine(line({ itemId: "unknown" }), DEFAULT_PRICING)).toBeNull();
  });
});

describe("итог заказа", () => {
  it("добивает минимум только по известным блюдам", () => {
    const result = calculateOrder(
      [line({ itemId: "k-fries", key: "fries" })],
      DEFAULT_PRICING,
      { deliveryMethod: "pickup", outOfTown: false },
    );
    expect(result.knownFood).toBe(149);
    expect(result.minUplift).toBe(351);
    expect(result.totalKnown).toBe(500);
    expect(result.hasQuote).toBe(false);
  });

  it("не считает своё блюдо бесплатным и отделяет его от минимума", () => {
    const result = calculateOrder(
      [
        line({ key: "burger" }),
        line({
          key: "custom",
          itemId: "custom",
          variant: "single",
          customDescription: "Собрать бокс без лука",
        }),
      ],
      DEFAULT_PRICING,
      { deliveryMethod: "pickup", outOfTown: false },
    );
    expect(result.knownFood).toBe(349);
    expect(result.hasQuote).toBe(true);
    expect(result.quoteCount).toBe(1);
    expect(result.minUplift).toBe(151);
    expect(result.totalKnown).toBe(500);
    const custom = result.lines.find((entry) => entry.key === "custom");
    expect(custom?.lineTotal).toBeNull();
    expect(custom?.quote).toBe(true);
  });

  it("не добавляет минимум, если известных блюд нет", () => {
    const result = calculateOrder(
      [
        line({
          key: "custom",
          itemId: "custom",
          variant: "single",
          customDescription: "Только своё блюдо, цена по запросу",
        }),
      ],
      DEFAULT_PRICING,
      { deliveryMethod: "pickup", outOfTown: false },
    );
    expect(result.knownFood).toBe(0);
    expect(result.minUplift).toBe(0);
    expect(result.totalKnown).toBe(0);
    expect(result.hasQuote).toBe(true);
  });

  it("добавляет доставку и выезд за город отдельно", () => {
    const result = calculateOrder([line({})], DEFAULT_PRICING, {
      deliveryMethod: "delivery",
      outOfTown: true,
    });
    expect(result.knownFood).toBe(349);
    expect(result.minUplift).toBe(151);
    expect(result.deliveryFee).toBe(149);
    expect(result.outOfTownFee).toBe(300);
    expect(result.totalKnown).toBe(949);
  });

  it("не добавляет доставку при самовывозе", () => {
    const result = calculateOrder([line({})], DEFAULT_PRICING, {
      deliveryMethod: "pickup",
      outOfTown: true,
    });
    expect(result.deliveryFee).toBe(0);
    expect(result.outOfTownFee).toBe(0);
  });

  it("помечает недоступные позиции", () => {
    const pricing = sanitizePricing({
      ...DEFAULT_PRICING,
      items: {
        ...DEFAULT_PRICING.items,
        "b-boxy": { ...DEFAULT_PRICING.items["b-boxy"], available: false },
      },
    });
    const result = calculateOrder([line({})], pricing, {
      deliveryMethod: "pickup",
      outOfTown: false,
    });
    expect(result.invalidKeys).toEqual(["line-1"]);
    expect(result.lines).toHaveLength(0);
  });
});

describe("санитайзер цен", () => {
  it("округляет и ограничивает проценты", () => {
    const pricing = sanitizePricing({
      ...DEFAULT_PRICING,
      doublePercent: 999,
      secondSaucePercent: -5,
    });
    expect(pricing.doublePercent).toBe(200);
    expect(pricing.secondSaucePercent).toBe(0);
  });

  it("оставляет своему блюду только доступность", () => {
    const pricing = sanitizePricing({
      ...DEFAULT_PRICING,
      items: {
        ...DEFAULT_PRICING.items,
        custom: { single: 900, standard: 500, available: false },
      },
    });
    expect(pricing.items.custom).toEqual({ single: 0, available: false });
  });
});
