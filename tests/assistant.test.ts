import { describe, expect, it } from "vitest";
import { answerAssistant } from "@/lib/assistant/brain";
import {
  extractOrderToken,
  matchMenuItems,
  normalizeText,
  priceSummary,
} from "@/lib/assistant/knowledge";
import type { AssistantContext, AssistantOrderInfo } from "@/lib/assistant/types";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";
import { getItem } from "@/lib/menu";

function settings(mutate?: (value: AppSettings) => void): AppSettings {
  const copy = structuredClone(DEFAULT_SETTINGS);
  mutate?.(copy);
  return copy;
}

function context(overrides: Partial<AssistantContext> = {}): AssistantContext {
  return { settings: settings(), order: { kind: "none" }, ...overrides };
}

const ORDER: AssistantOrderInfo = {
  orderNo: "TB-261113-ABCD",
  status: "confirmed",
  statusLabel: "Подтверждён",
  totalKnown: 1200,
  finalTotal: 1350,
  hasQuote: false,
  agreedAtLabel: "13 ноября, 18:30",
  deliveryLabel: "Доставка",
  createdAtLabel: "13 ноября, 17:40",
  url: "/order/token-value",
};

describe("нормализация и поиск по меню", () => {
  it("приводит текст к нижнему регистру, убирает ё и пунктуацию", () => {
    expect(normalizeText("Сырная ШАУРМА, ёлка!")).toBe("сырная шаурма елка");
  });

  it("находит позицию по разговорному названию", () => {
    expect(matchMenuItems("хочу дабл смэш")[0]?.item.id).toBe("b-double");
    expect(matchMenuItems("картошку пожалуйста")[0]?.item.id).toBe("k-fries");
    expect(matchMenuItems("зелёный бокс")[0]?.item.id).toBe("b-green");
  });

  it("не считает «бургер» конкретной позицией", () => {
    expect(matchMenuItems("бургер")).toHaveLength(0);
  });

  it("достаёт токен из ссылки и из сырого текста", () => {
    expect(extractOrderToken("вот ссылка https://teplybox.test/order/abcDEF1234567890xyz")).toBe(
      "abcDEF1234567890xyz",
    );
    const raw = "a1".repeat(16);
    expect(extractOrderToken(`токен ${raw}`)).toBe(raw);
    expect(extractOrderToken("просто вопрос про меню")).toBeNull();
  });
});

describe("цены берутся из настроек, а не из кода", () => {
  it("показывает изменённую цену позиции", () => {
    const reply = answerAssistant(
      "сколько стоит боксик",
      context({
        settings: settings((value) => {
          value.pricing.items["b-boxy"] = { standard: 1234, large: 1500, available: true };
        }),
      }),
    );
    expect(reply.intent).toBe("item");
    expect(reply.text).toMatch(/1\s*234/);
    expect(reply.add?.line).toMatchObject({
      itemId: "b-boxy",
      variant: "standard",
      qty: 1,
      options: [],
    });
  });

  it("учитывает недоступность позиции и не предлагает её в корзину", () => {
    const reply = answerAssistant(
      "боксик",
      context({
        settings: settings((value) => {
          value.pricing.items["b-boxy"] = { standard: 349, large: 449, available: false };
        }),
      }),
    );
    expect(reply.intent).toBe("item-unavailable");
    expect(reply.add).toBeUndefined();
  });

  it("пересчитывает минимальную цену в обзоре меню", () => {
    const reply = answerAssistant(
      "покажи меню",
      context({
        settings: settings((value) => {
          for (const id of ["b-chicken", "b-double", "b-green"]) {
            value.pricing.items[id]!.available = false;
          }
          value.pricing.items["b-boxy"] = { standard: 1234, large: 1500, available: true };
        }),
      }),
    );
    expect(reply.intent).toBe("menu");
    const text = (reply.bullets ?? []).join(" ");
    expect(text).toMatch(/Бургеры \(от 1\s*234/);
  });

  it("берёт проценты добавок из настроек", () => {
    const reply = answerAssistant(
      "расскажи про дабл смэш",
      context({
        settings: settings((value) => {
          value.pricing.doublePercent = 40;
          value.pricing.secondSaucePercent = 20;
        }),
      }),
    );
    const text = (reply.bullets ?? []).join(" ");
    expect(text).toContain("+40%");
    expect(text).toContain("+20%");
  });

  it("форматирует цену без выдуманных значений", () => {
    const item = getItem("t-cookie")!;
    expect(priceSummary(item, DEFAULT_SETTINGS.pricing)).toMatch(/99/);
    expect(priceSummary(getItem("custom")!, DEFAULT_SETTINGS.pricing)).toBe("по запросу");
  });
});

describe("доставка, самовывоз и правила", () => {
  it("называет стоимость доставки, выезда за город и минимум", () => {
    const reply = answerAssistant("сколько стоит доставка?", context());
    expect(reply.intent).toBe("delivery");
    expect(reply.text).toMatch(/149/);
    const bullets = (reply.bullets ?? []).join(" ");
    expect(bullets).toMatch(/500/);
    expect(reply.text).toContain("за город");
    expect(reply.text).toMatch(/300/);
  });

  it("говорит про бесплатный выезд за город, если доплата отключена", () => {
    const reply = answerAssistant(
      "доставка за город",
      context({
        settings: settings((value) => {
          value.pricing.outOfTownFee = 0;
        }),
      }),
    );
    expect(reply.text).toContain("без доплаты");
  });

  it("показывает адрес самовывоза и часы", () => {
    const reply = answerAssistant("можно самовывоз?", context());
    expect(reply.intent).toBe("pickup");
    expect(reply.text).toContain(DEFAULT_SETTINGS.company.address);
    expect(reply.text).toContain(DEFAULT_SETTINGS.company.workingHours);
  });

  it("объясняет минимальный заказ", () => {
    const reply = answerAssistant("какой минимальный заказ?", context());
    expect(reply.intent).toBe("min-order");
    expect(reply.text).toMatch(/500/);
    expect((reply.bullets ?? []).join(" ")).toContain("известной ценой");
  });

  it("честно говорит, что онлайн-оплаты нет", () => {
    const reply = answerAssistant("можно оплатить картой?", context());
    expect(reply.intent).toBe("payment");
    expect(reply.text).toContain("не подключена");
  });
});

describe("подбор блюд", () => {
  it("советует хиты и даёт действие добавления", () => {
    const reply = answerAssistant("что посоветуешь?", context());
    expect(reply.intent).toBe("recommend");
    expect(reply.add?.line.itemId).toBe("b-boxy");
    expect((reply.bullets ?? []).length).toBeGreaterThan(0);
  });

  it("показывает острые позиции по тегам", () => {
    const reply = answerAssistant("хочу что-то остренькое", context());
    expect(reply.intent).toBe("spicy");
    expect(reply.text).toContain("Дабл-смэш");
    expect(reply.text).toContain("Шаурма остряк");
  });

  it("убирает острое, если гость просит без острого", () => {
    const reply = answerAssistant("не люблю острое", context());
    expect(reply.intent).toBe("spicy-mild");
    expect(reply.text).toContain("без острого");
    expect((reply.bullets ?? []).join(" ")).toContain("Боксик-бургер");
  });

  it("находит веганские позиции и честно оговаривает сыр", () => {
    const reply = answerAssistant("есть что-то веганское?", context());
    expect(reply.intent).toBe("vegan");
    const text = (reply.bullets ?? []).join(" ");
    expect(text).toContain("Зелёный бокс");
    expect(text).toContain("Маргарита");
  });

  it("уточняет, если запрос подходит к двум позициям", () => {
    const reply = answerAssistant("сырная", context());
    expect(reply.intent).toBe("item-clarify");
    const text = (reply.bullets ?? []).join(" ");
    expect(text).toContain("Шаурма сырная");
    expect(text).toContain("Сырный цыплёнок");
  });

  it("для своего блюда требует фото и не кладёт его в корзину", () => {
    const reply = answerAssistant("хочу своё блюдо", context());
    expect(reply.intent).toBe("custom-dish");
    expect(reply.text).toContain("фото");
    expect((reply.bullets ?? []).join(" ")).toContain("по запросу");
    expect(reply.add).toBeUndefined();
  });
});

describe("статус заказа", () => {
  it("показывает статус, сумму и ссылку, но не обещает лишнего", () => {
    const reply = answerAssistant("статус", {
      settings: settings(),
      order: { kind: "found", order: ORDER },
    });
    expect(reply.intent).toBe("order-status");
    expect(reply.text).toContain("Подтверждён");
    expect((reply.bullets ?? []).join(" ")).toMatch(/1\s*350/);
    expect(reply.link?.href).toBe("/order/token-value");
    expect(reply.bullets?.join(" ")).not.toContain("телефон");
  });

  it("просит ссылку, если её нет", () => {
    const reply = answerAssistant("где мой заказ?", context());
    expect(reply.intent).toBe("order-status");
    expect(reply.text).toContain("приватной ссылке");
  });

  it("сообщает, что заказ не найден", () => {
    const reply = answerAssistant("статус", {
      settings: settings(),
      order: { kind: "not-found" },
    });
    expect(reply.text).toContain("Не нашёл заказ");
  });
});

describe("запасные ответы", () => {
  it("не выдумывает цены, если вопрос непонятен", () => {
    const reply = answerAssistant("абракадабра", context());
    expect(reply.intent).toBe("fallback");
    expect(reply.text).not.toContain("₽");
    expect(reply.chips && reply.chips.length).toBeGreaterThan(0);
  });

  it("здоровается по имени персонажа из настроек", () => {
    const reply = answerAssistant("привет", context());
    expect(reply.intent).toBe("greeting");
    expect(reply.text).toContain(DEFAULT_SETTINGS.character.name);
  });

  it("понимает приветствие вместе с вопросом", () => {
    const reply = answerAssistant("привет, сколько стоит доставка?", context());
    expect(reply.intent).toBe("delivery");
  });

  it("уточняет блюдо, если спросили цену без названия", () => {
    const reply = answerAssistant("сколько стоит?", context());
    expect(reply.intent).toBe("price-clarify");
    expect(reply.chips?.length).toBeGreaterThan(0);
  });

  it("объясняет, как оформить заказ", () => {
    const reply = answerAssistant("как оформить заказ?", context());
    expect(reply.intent).toBe("how-to-order");
    expect(reply.bullets?.length).toBeGreaterThanOrEqual(3);
  });
});
