import { describe, expect, it } from "vitest";
import {
  sanitizeCharacter,
  sanitizeCompany,
  sanitizeGame,
  DEFAULT_COMPANY,
} from "@/lib/settings";
import { formatPhone, normalizePhone, statusLabel } from "@/lib/format";
import { bonusCode, localDateTimeToUtc, orderNumber, publicToken } from "@/lib/tokens";

describe("настройки компании", () => {
  it("подставляет значения по умолчанию для пустых полей", () => {
    const company = sanitizeCompany({ name: "   ", email: "не почта", phone: "abc" });
    expect(company.name).toBe(DEFAULT_COMPANY.name);
    expect(company.email).toBe("");
    expect(company.phone).toBe("");
  });

  it("сохраняет корректные контакты и нормализует цвет", () => {
    const company = sanitizeCompany({
      phone: "+7 912 345-67-89",
      email: "OWNER@EXAMPLE.RU",
      accent: "#ABC",
    });
    expect(company.phone).toBe("+7 912 345-67-89");
    expect(company.email).toBe("owner@example.ru");
    expect(company.accent).toBe("#abc");
  });

  it("откатывает неизвестный часовой пояс", () => {
    const company = sanitizeCompany({ timezone: "Mars/Olympus" });
    expect(company.timezone).toBe(DEFAULT_COMPANY.timezone);
  });
});

describe("настройки игры и персонажа", () => {
  it("очищает префикс кода", () => {
    const game = sanitizeGame({ mode: "bonus", codePrefix: "bo x-1" });
    expect(game.codePrefix).toBe("BOX1");
    expect(game.mode).toBe("bonus");
  });

  it("ограничивает срок и сумму бонуса", () => {
    const game = sanitizeGame({ bonusAmount: 99999, bonusDays: 0, bonusMinOrder: -50 });
    expect(game.bonusAmount).toBe(5000);
    expect(game.bonusDays).toBe(1);
    expect(game.bonusMinOrder).toBe(0);
  });

  it("не даёт неизвестный пресет персонажа", () => {
    const character = sanitizeCharacter({ preset: "dragon" as never, name: "" });
    expect(character.preset).toBe("boxy");
    expect(character.name).toBe("Боксик");
  });
});

describe("телефон и статусы", () => {
  it("нормализует российские номера", () => {
    expect(normalizePhone("8 (912) 345-67-89")).toBe("+79123456789");
    expect(normalizePhone("9123456789")).toBe("+79123456789");
    expect(normalizePhone("123")).toBeNull();
    expect(formatPhone("+79123456789")).toBe("+7 (912) 345-67-89");
  });

  it("переводит статусы", () => {
    expect(statusLabel("confirmed")).toBe("Подтверждён");
    expect(statusLabel("unknown")).toBe("unknown");
  });
});

describe("токены и время", () => {
  it("создаёт длинный непредсказуемый токен", () => {
    const token = publicToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(publicToken()).not.toBe(token);
  });

  it("формирует номер заказа по часовому поясу", () => {
    const number = orderNumber("Europe/Samara", new Date("2026-01-02T20:30:00Z"));
    // 03.01.2026 00:30 в Самаре (+04).
    expect(number).toMatch(/^TB-260103-[23456789A-Z]{4}$/);
  });

  it("формирует бонусный код с префиксом", () => {
    expect(bonusCode("box")).toMatch(/^BOX-[A-Z2-9]{6}$/);
  });

  it("переводит локальное время Самары в UTC", () => {
    const date = localDateTimeToUtc("2026-05-01T18:30", "Europe/Samara");
    expect(date?.toISOString()).toBe("2026-05-01T14:30:00.000Z");
  });

  it("отклоняет неверный формат времени", () => {
    expect(localDateTimeToUtc("01.05.2026 18:30", "Europe/Samara")).toBeNull();
  });
});
