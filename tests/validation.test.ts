import { describe, expect, it } from "vitest";
import { createOrderSchema, orderUpdateSchema } from "@/lib/validation";

const base = {
  idempotencyKey: "idem_1234567890_abcd",
  items: [
    {
      key: "b-boxy|standard|",
      itemId: "b-boxy",
      variant: "standard",
      qty: 1,
      options: [],
    },
  ],
  customerName: "Анна",
  phone: "+7 (912) 345-67-89",
  deliveryMethod: "pickup",
  address: "",
  outOfTown: false,
  preferredDate: "",
  preferredTime: "",
  comment: "",
  consent: true,
};

describe("заявка на заказ", () => {
  it("принимает корректный самовывоз", () => {
    const parsed = createOrderSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("требует согласие", () => {
    const parsed = createOrderSchema.safeParse({ ...base, consent: false });
    expect(parsed.success).toBe(false);
  });

  it("требует адрес для доставки", () => {
    const parsed = createOrderSchema.safeParse({ ...base, deliveryMethod: "delivery" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.includes("address"))).toBe(true);
    }
  });

  it("требует дату, если указано время", () => {
    const parsed = createOrderSchema.safeParse({ ...base, preferredTime: "18:30" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.includes("preferredDate"))).toBe(true);
    }
  });

  it("запрещает выезд за город при самовывозе", () => {
    const parsed = createOrderSchema.safeParse({ ...base, outOfTown: true });
    expect(parsed.success).toBe(false);
  });

  it("требует описание для своего блюда", () => {
    const parsed = createOrderSchema.safeParse({
      ...base,
      items: [
        {
          key: "custom|single|",
          itemId: "custom",
          variant: "single",
          qty: 1,
          options: [],
          customDescription: "Коротко",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("принимает своё блюдо с описанием", () => {
    const parsed = createOrderSchema.safeParse({
      ...base,
      items: [
        {
          key: "custom|single|",
          itemId: "custom",
          variant: "single",
          qty: 1,
          options: [],
          customDescription: "Собрать бокс без лука и с острым соусом",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("запрещает две позиции своего блюда", () => {
    const custom = {
      key: "custom|single|a",
      itemId: "custom",
      variant: "single",
      qty: 1,
      options: [],
      customDescription: "Собрать бокс без лука и с острым соусом",
    };
    const parsed = createOrderSchema.safeParse({
      ...base,
      items: [custom, { ...custom, key: "custom|single|b" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("отклоняет неизвестный вариант", () => {
    const parsed = createOrderSchema.safeParse({
      ...base,
      items: [{ ...base.items[0], variant: "huge" }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("обновление заказа владельцем", () => {
  it("принимает пустую заметку и null-цену", () => {
    const parsed = orderUpdateSchema.safeParse({
      status: "new",
      finalTotal: null,
      agreedAtLocal: "",
      adminNote: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("отклоняет отрицательную цену", () => {
    const parsed = orderUpdateSchema.safeParse({ status: "confirmed", finalTotal: -1 });
    expect(parsed.success).toBe(false);
  });
});
