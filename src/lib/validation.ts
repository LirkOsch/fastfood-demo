import { z } from "zod";
import { normalizePhone } from "./format";
import { OPTION_IDS, VARIANT_IDS } from "./menu";

const variantSchema = z.enum(VARIANT_IDS as [string, ...string[]], {
  error: "Неизвестный размер порции.",
});
const optionSchema = z.enum(OPTION_IDS as [string, ...string[]], {
  error: "Неизвестная добавка.",
});

export const cartLineSchema = z.object({
  key: z
    .string({ error: "Некорректная позиция корзины." })
    .min(1, "Некорректная позиция корзины.")
    .max(240, "Некорректная позиция корзины."),
  itemId: z
    .string({ error: "Неизвестное блюдо." })
    .min(1, "Неизвестное блюдо.")
    .max(60, "Неизвестное блюдо."),
  variant: variantSchema,
  qty: z
    .number({ error: "Укажите количество порций." })
    .int("Количество должно быть целым.")
    .min(1, "Минимум одна порция.")
    .max(50, "Не больше 50 порций одной позиции."),
  options: z
    .array(optionSchema, { error: "Некорректные добавки." })
    .max(2, "Не больше двух добавок к позиции.")
    .default([]),
  customDescription: z
    .string({ error: "Опишите своё блюдо." })
    .max(600, "Описание слишком длинное (до 600 символов).")
    .optional(),
});

export const createOrderSchema = z
  .object({
    idempotencyKey: z
      .string({ error: "Некорректный ключ отправки." })
      .min(16, "Некорректный ключ отправки.")
      .max(80, "Некорректный ключ отправки.")
      .regex(/^[A-Za-z0-9_-]+$/, "Некорректный ключ отправки."),
    items: z
      .array(cartLineSchema, { error: "Добавьте хотя бы одно блюдо." })
      .min(1, "Добавьте хотя бы одно блюдо.")
      .max(40, "В заказе слишком много позиций (до 40)."),
    customerName: z
      .string({ error: "Как к вам обращаться?" })
      .trim()
      .min(2, "Как к вам обращаться?")
      .max(80, "Имя слишком длинное (до 80 символов)."),
    phone: z
      .string({ error: "Укажите телефон." })
      .trim()
      .min(10, "Укажите телефон.")
      .max(25, "Телефон слишком длинный.")
      .refine((value) => normalizePhone(value) !== null, "Проверьте номер телефона."),
    deliveryMethod: z.enum(["delivery", "pickup"], {
      error: "Выберите способ получения.",
    }),
    address: z
      .string({ error: "Укажите адрес доставки." })
      .trim()
      .max(220, "Адрес слишком длинный (до 220 символов).")
      .optional()
      .default(""),
    outOfTown: z.boolean({ error: "Некорректное значение выезда за город." }).default(false),
    preferredDate: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата."), z.literal("")], {
        error: "Некорректная дата.",
      })
      .optional()
      .default(""),
    preferredTime: z
      .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Некорректное время."), z.literal("")], {
        error: "Некорректное время.",
      })
      .optional()
      .default(""),
    comment: z
      .string({ error: "Некорректный комментарий." })
      .trim()
      .max(1000, "Комментарий слишком длинный (до 1000 символов).")
      .optional()
      .default(""),
    consent: z
      .boolean({ error: "Подтвердите согласие на обработку данных." })
      .refine((value) => value === true, {
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

const shortText = (max: number, label: string) => `${label}: не больше ${max} символов.`;
const money = (max = 1000000) =>
  z
    .number({ error: "Введите сумму числом." })
    .min(0, "Сумма не может быть отрицательной.")
    .max(max, "Слишком большая сумма.");

export const companySchema = z.object({
  name: z
    .string({ error: "Укажите название кафе." })
    .min(1, "Укажите название кафе.")
    .max(60, shortText(60, "Название")),
  tagline: z.string({ error: "Укажите слоган." }).max(100, shortText(100, "Слоган")),
  description: z
    .string({ error: "Добавьте описание." })
    .max(800, shortText(800, "Описание")),
  phone: z.string({ error: "Укажите телефон." }).max(25, shortText(25, "Телефон")),
  email: z.string({ error: "Укажите e-mail." }).max(120, shortText(120, "E-mail")),
  city: z.string({ error: "Укажите город." }).max(80, shortText(80, "Город")),
  deliveryArea: z
    .string({ error: "Укажите зону доставки." })
    .max(160, shortText(160, "Зона доставки")),
  address: z.string({ error: "Укажите адрес." }).max(160, shortText(160, "Адрес")),
  workingHours: z
    .string({ error: "Укажите часы работы." })
    .max(120, shortText(120, "Часы работы")),
  accent: z
    .string({ error: "Выберите цвет." })
    .regex(
      /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
      "Цвет должен быть в формате #RGB или #RRGGBB.",
    ),
  timezone: z
    .string({ error: "Укажите часовой пояс." })
    .max(80, shortText(80, "Часовой пояс")),
  legalName: z
    .string({ error: "Укажите юридическое имя." })
    .max(160, shortText(160, "Юридическое имя")),
});

export const pricingSchema = z.object({
  version: z.number({ error: "Некорректная версия настроек." }).optional(),
  items: z.record(z.string(), z.any()),
  minOrder: money(),
  deliveryFee: money(),
  outOfTownFee: money(),
  doublePercent: z
    .number({ error: "Введите процент числом." })
    .min(0, "Процент не может быть отрицательным.")
    .max(200, "Процент не больше 200."),
  secondSaucePercent: z
    .number({ error: "Введите процент числом." })
    .min(0, "Процент не может быть отрицательным.")
    .max(200, "Процент не больше 200."),
});

export const gameSchema = z.object({
  mode: z.enum(["off", "play", "bonus"], { error: "Выберите режим игры." }),
  bonusAmount: money(),
  bonusDays: z
    .number({ error: "Укажите срок в днях." })
    .int("Срок должен быть целым числом дней.")
    .min(0, "Срок не может быть отрицательным.")
    .max(3650, "Срок не больше 3650 дней."),
  bonusMinOrder: money(),
  codePrefix: z
    .string({ error: "Укажите префикс кода." })
    .max(8, shortText(8, "Префикс кода")),
});

export const characterSchema = z.object({
  preset: z.enum(["boxy", "bun", "none"], { error: "Выберите персонажа." }),
  faces: z.boolean({ error: "Некорректная настройка лиц." }),
  phrases: z.boolean({ error: "Некорректная настройка фраз." }),
  name: z.string({ error: "Укажите имя персонажа." }).max(40, shortText(40, "Имя")),
});

export const orderUpdateSchema = z.object({
  status: z.enum(["new", "confirmed", "completed", "cancelled"], {
    error: "Выберите статус заказа.",
  }),
  finalTotal: z
    .number({ error: "Введите сумму числом." })
    .int("Введите целую сумму в рублях.")
    .min(0, "Сумма не может быть отрицательной.")
    .max(1000000, "Слишком большая сумма.")
    .nullable()
    .optional(),
  agreedAtLocal: z
    .union(
      [
        z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Укажите дату и время."),
        z.literal(""),
        z.null(),
      ],
      { error: "Укажите дату и время." },
    )
    .optional(),
  adminNote: z
    .string({ error: "Некорректная заметка." })
    .max(2000, "Заметка слишком длинная (до 2000 символов).")
    .nullable()
    .optional(),
});

export const deleteOrderSchema = z.object({
  confirm: z
    .string({ error: "Введите номер заказа." })
    .max(40, "Номер заказа слишком длинный."),
  acknowledgedPhotos: z.boolean({ error: "Подтвердите удаление фото." }).optional(),
});

export const loginSchema = z.object({
  email: z
    .string({ error: "Укажите e-mail." })
    .trim()
    .min(3, "Укажите e-mail.")
    .max(160, "E-mail слишком длинный."),
  password: z
    .string({ error: "Укажите пароль." })
    .min(1, "Укажите пароль.")
    .max(200, "Пароль слишком длинный."),
});

export const passwordSchema = z.object({
  currentPassword: z
    .string({ error: "Введите текущий пароль." })
    .min(1, "Введите текущий пароль.")
    .max(200, "Пароль слишком длинный."),
  newPassword: z
    .string({ error: "Придумайте новый пароль." })
    .min(10, "Новый пароль должен быть не короче 10 символов.")
    .max(200, "Пароль слишком длинный."),
});

export const bonusRedeemSchema = z.object({
  status: z.literal("redeemed", { error: "Некорректный статус бонуса." }),
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
