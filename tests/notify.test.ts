import { afterEach, describe, expect, it, vi } from "vitest";

// retention.ts помечен "server-only" и тянет за собой базу — в юнит-тестах
// модуль-заглушка достаточен, потому что проверяются только чистые функции.
vi.mock("server-only", () => ({}));

import {
  buildNewOrderMessage,
  buildStatusMessage,
  notificationsConfigured,
  sendTelegramMessage,
  type OrderNotice,
} from "@/lib/notify";
import { DEFAULT_RETENTION_DAYS, retentionDays } from "@/lib/retention";

const notice: OrderNotice = {
  orderNo: "TB-261115-ABCD",
  customerName: "Тест <Клиент>",
  phone: "+79120000001",
  deliveryMethod: "delivery",
  outOfTown: true,
  address: "ул. Тёплая, 12",
  lines: [
    { name: "Чикен-бокс", variantLabel: "Стандарт", qty: 2, quote: false },
    { name: "Своё блюдо", variantLabel: "Стандарт", qty: 1, quote: true },
  ],
  totalKnown: 658,
  hasQuote: true,
  comment: "Без лука",
  preferredDate: "2026-11-16",
  preferredTime: "13:00",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("сообщение о новом заказе", () => {
  it("содержит номер, клиента, состав и сумму", () => {
    const text = buildNewOrderMessage(notice, "https://example.test/admin");
    expect(text).toContain("Новый заказ TB-261115-ABCD");
    expect(text).toContain("Доставка (за город): ул. Тёплая, 12");
    expect(text).toContain("2 × Чикен-бокс (Стандарт)");
    expect(text).toContain("цена по запросу");
    expect(text).toContain("658");
    expect(text).toContain("Без лука");
    expect(text).toContain("https://example.test/admin");
  });

  it("экранирует пользовательский текст, чтобы не ломать HTML Telegram", () => {
    const text = buildNewOrderMessage(notice, "");
    expect(text).toContain("Тест &lt;Клиент&gt;");
    expect(text).not.toContain("Тест <Клиент>");
  });

  it("показывает самовывоз без адреса", () => {
    const text = buildNewOrderMessage(
      { ...notice, deliveryMethod: "pickup", address: null, outOfTown: false, comment: null },
      "",
    );
    expect(text).toContain("Самовывоз");
    expect(text).not.toContain("Доставка");
  });

  it("обрезает слишком длинный список позиций", () => {
    const lines = Array.from({ length: 20 }, (_, index) => ({
      name: `Блюдо ${index + 1}`,
      variantLabel: "Стандарт",
      qty: 1,
      quote: false,
    }));
    const text = buildNewOrderMessage({ ...notice, lines }, "");
    expect(text).toContain("…и ещё 8 поз.");
    expect(text.length).toBeLessThanOrEqual(3900);
  });
});

describe("сообщение о смене статуса", () => {
  it("рассказывает про подтверждение с ценой и временем", () => {
    const text = buildStatusMessage(
      {
        orderNo: "TB-261115-ABCD",
        customerName: "Тест",
        phone: "+79120000001",
        status: "confirmed",
        finalTotal: 900,
        agreedAtText: "16 ноября, 13:00",
      },
      "https://example.test/admin/orders/1",
    );
    expect(text).toContain("Заказ подтверждён");
    expect(text).toContain("900");
    expect(text).toContain("16 ноября, 13:00");
  });

  it("про отмену пишет отдельно и без суммы, если её нет", () => {
    const text = buildStatusMessage(
      {
        orderNo: "TB-261115-ABCD",
        customerName: "Тест",
        phone: "+79120000001",
        status: "cancelled",
        finalTotal: null,
        agreedAtText: null,
      },
      "",
    );
    expect(text).toContain("Заказ отменён");
    expect(text).not.toContain("Итог:");
  });
});

describe("настройка уведомлений", () => {
  it("выключена без токена и chat_id", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    expect(notificationsConfigured()).toBe(false);
  });

  it("включается, когда заданы оба значения", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-100123");
    expect(notificationsConfigured()).toBe(true);
  });

  it("отправляет сообщение в Telegram и не раскрывает токен в ошибке", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:secret-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-100123");
    vi.stubEnv("TELEGRAM_API_URL", "https://telegram.test");

    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTelegramMessage("привет");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://telegram.test/bot123:secret-token/sendMessage");
    expect(JSON.parse(String(init.body))).toMatchObject({ chat_id: "-100123", text: "привет" });
  });

  it("возвращает понятную ошибку, если Telegram недоступен", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:secret-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-100123");
    vi.stubEnv("TELEGRAM_API_URL", "https://telegram.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"ok":false}', { status: 403 })),
    );

    const result = await sendTelegramMessage("привет");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("403");
    expect(result.error).not.toContain("secret-token");
  });
});

describe("срок хранения заказов", () => {
  it("по умолчанию 90 дней", () => {
    expect(retentionDays({})).toBe(DEFAULT_RETENTION_DAYS);
  });

  it("принимает разумное значение из окружения", () => {
    expect(retentionDays({ RETENTION_DAYS: "30" })).toBe(30);
  });

  it("не доверяет мусору и слишком маленьким значениям", () => {
    expect(retentionDays({ RETENTION_DAYS: "abc" })).toBe(
      DEFAULT_RETENTION_DAYS,
    );
    expect(retentionDays({ RETENTION_DAYS: "0" })).toBe(
      DEFAULT_RETENTION_DAYS,
    );
    expect(retentionDays({ RETENTION_DAYS: "-5" })).toBe(
      DEFAULT_RETENTION_DAYS,
    );
  });

  it("ограничивает верхнюю границу", () => {
    expect(retentionDays({ RETENTION_DAYS: "99999" })).toBe(3650);
  });
});
