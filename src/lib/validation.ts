import { z } from "zod";
import { normalizePhone } from "./format";
import { OPTION_IDS, VARIANT_IDS } from "./menu";

const variantSchema = z.enum(VARIANT_IDS as [string, ...string[]]);
const optionSchema = z.enum(OPTION_IDS as [string, ...string[]]);

export const cartLineSchema = z.object({
  key: z.string().min(1).max(240),
  itemId: z.string().min(1).max(60),
  variant: variantSchema,
  qty: z.number().int().min(1).max(50),
  options: z.array(optionSchema).max(2).default([]),
  customDescription: z.string().max(600).optional(),
});

export const createOrderSchema = z
  .object({
    idempotencyKey: z
      .string()
      .min(16)
      .max(80)
      .regex(/^[A-Za-z0-9_-]+$/, "Некорректный ключ отправки."),
    items: z.array(cartLineSchema).min(1, "Добавьте хотя бы одно блюдо.").max(40),
    customerName: z.string().trim().min(2, "Как к вам обращаться?").max(80),
    phone: z
      .string()
      .trim()
      .min(10, "Укажите телефон.")
      .max(25)
      .refine((value) => normalizePhone(value) !== null, "Проверьте номер телефона."),
    deliveryMethod: z.enum(["delivery", "pickup"]),
    address: z.string().trim().max(220).optional().default(""),
    outOfTown: z.boolean().default(false),
    preferredDate: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
      .optional()
      .default(""),
    preferredTime: z
      .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal("")])
      .optional()
      .default(""),
    comment: z.string().trim().max(1000).optional().default(""),
    consent: z.boolean().refine((value) => value === true, {
      message: "Без согласия на обработку данных мы не можем принять заказ.",
    }),
  })
  .superRefine((value, ctx) => {
    if (value.deliveryMethod === "delivery" && value.address.trim().length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Укажите улицу, дом и квартиру для доставки.",
      });
    }
    if (value.preferredTime && !value.preferredDate) {
      ctx.addIssue({
        code: "custom",
        path: ["preferredDate"],
        message: "Чтобы указать время, выберите дату.",
      });
    }
    if (value.deliveryMethod === "pickup" && value.outOfTown) {
      ctx.addIssue({
        code: "custom",
        path: ["outOfTown"],
        message: "Выезд за город доступен только для доставки.",
      });
    }
    const customLines = value.items.filter((line) => line.itemId === "custom");
    if (customLines.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Своё блюдо можно добавить только одной позицией.",
      });
    }
    for (const line of customLines) {
      if (!line.customDescription || line.customDescription.trim().length < 10) {
        ctx.addIssue({
          code: "custom",
          path: ["items"],
          message: "Опишите своё блюдо хотя бы в двух предложениях.",
        });
      }
    }
  });

export const companySchema = z.object({
  name: z.string().min(1).max(60),
  tagline: z.string().max(100),
  description: z.string().max(800),
  phone: z.string().max(25),
  email: z.string().max(120),
  city: z.string().max(80),
  deliveryArea: z.string().max(160),
  address: z.string().max(160),
  workingHours: z.string().max(120),
  accent: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  timezone: z.string().max(80),
  legalName: z.string().max(160),
});

export const pricingSchema = z.object({
  version: z.number().optional(),
  items: z.record(z.string(), z.any()),
  minOrder: z.number(),
  deliveryFee: z.number(),
  outOfTownFee: z.number(),
  doublePercent: z.number(),
  secondSaucePercent: z.number(),
});

export const gameSchema = z.object({
  mode: z.enum(["off", "play", "bonus"]),
  bonusAmount: z.number(),
  bonusDays: z.number(),
  bonusMinOrder: z.number(),
  codePrefix: z.string().max(8),
});

export const characterSchema = z.object({
  preset: z.enum(["boxy", "bun", "none"]),
  faces: z.boolean(),
  phrases: z.boolean(),
  name: z.string().max(40),
});

export const orderUpdateSchema = z.object({
  status: z.enum(["new", "confirmed", "completed", "cancelled"]),
  finalTotal: z.number().int().min(0).max(1000000).nullable().optional(),
  agreedAtLocal: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), z.literal(""), z.null()])
    .optional(),
  adminNote: z.string().max(2000).nullable().optional(),
});

export const deleteOrderSchema = z.object({
  confirm: z.string().max(40),
  acknowledgedPhotos: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(200),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10).max(200),
});

export const bonusRedeemSchema = z.object({
  status: z.literal("redeemed"),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Проверьте заполненные поля.";
}
