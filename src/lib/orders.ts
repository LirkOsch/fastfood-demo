import "server-only";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";
import { getDb, getAppSettings, isUniqueViolation } from "@/lib/db";
import {
  bonusCodes,
  orderEvents,
  orderPhotos,
  orders,
  type BonusCodeRow,
  type OrderEventRow,
  type PricingSnapshot,
  type StoredTotals,
} from "@/lib/db/schema";
import {
  calculateOrder,
  type CartLineInput,
  type PricedLine,
} from "@/lib/pricing";
import { normalizePhone, statusLabel } from "@/lib/format";
import { getCategory, getItem } from "@/lib/menu";
import { bonusCode, localDateTimeToUtc, orderNumber, publicToken } from "@/lib/tokens";
import type { ProcessedPhoto } from "@/lib/images";
import type { z } from "zod";
import type { createOrderSchema } from "@/lib/validation";

type CreateOrderInput = z.infer<typeof createOrderSchema>;

export interface CreateOrderSuccess {
  ok: true;
  token: string;
  orderNo: string;
  idempotent: boolean;
}

export interface ServiceFailure {
  ok: false;
  status: number;
  error: string;
  fieldErrors?: Record<string, string>;
}

export interface PublicOrderPhoto {
  id: string;
  width: number;
  height: number;
}

export interface PublicOrderEvent {
  type: string;
  label: string;
  createdAt: string;
}

export interface PublicBonus {
  code: string;
  amount: number;
  minOrder: number;
  status: string;
  expiresAt: string;
}

export interface PublicOrder {
  orderNo: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  phone: string;
  deliveryMethod: string;
  address: string | null;
  outOfTown: boolean;
  preferredDate: string | null;
  preferredTime: string | null;
  comment: string | null;
  items: PricedLine[];
  totals: StoredTotals;
  finalTotal: number | null;
  agreedAt: string | null;
  hasQuote: boolean;
  photos: PublicOrderPhoto[];
  events: PublicOrderEvent[];
  bonus: PublicBonus | null;
  gameMode: "off" | "play" | "bonus";
  timezone: string;
}

export async function createOrder(
  input: CreateOrderInput,
  photos: ProcessedPhoto[],
): Promise<CreateOrderSuccess | ServiceFailure> {
  const db = await getDb();
  const settings = await getAppSettings();
  const timezone = settings.company.timezone;

  const existing = await db
    .select({ token: orders.publicToken, orderNo: orders.orderNo })
    .from(orders)
    .where(eq(orders.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (existing[0]) {
    return {
      ok: true,
      token: existing[0].token,
      orderNo: existing[0].orderNo,
      idempotent: true,
    };
  }

  const dateError = validatePreferredTime(
    input.preferredDate,
    input.preferredTime,
    timezone,
  );
  if (dateError) {
    return {
      ok: false,
      status: 422,
      error: dateError,
      fieldErrors: { preferredDate: dateError },
    };
  }

  const lines: CartLineInput[] = [];
  for (const line of input.items) {
    const item = getItem(line.itemId);
    if (!item) {
      return {
        ok: false,
        status: 422,
        error: "В заказе есть неизвестное блюдо. Обновите меню.",
      };
    }
    const category = getCategory(item.categoryId);
    if (!category) {
      return { ok: false, status: 422, error: "Неизвестная категория блюда." };
    }
    if (!category.variants.includes(line.variant as never)) {
      return { ok: false, status: 422, error: `Неверный размер для «${item.name}».` };
    }
    const options = [...new Set(line.options)];
    if (options.some((option) => !item.options.includes(option as never))) {
      return { ok: false, status: 422, error: `Неверная добавка для «${item.name}».` };
    }
    if (item.isCustom) {
      if ((line.customDescription ?? "").trim().length < 10) {
        return {
          ok: false,
          status: 422,
          error: "Опишите своё блюдо подробнее.",
          fieldErrors: { customDescription: "Нужно описание не короче 10 символов." },
        };
      }
      if (line.qty !== 1) {
        return { ok: false, status: 422, error: "Своё блюдо добавляется одной позицией." };
      }
    }
    lines.push({
      key: line.key,
      itemId: line.itemId,
      variant: line.variant as CartLineInput["variant"],
      qty: line.qty,
      options: options as CartLineInput["options"],
      customDescription: line.customDescription,
    });
  }

  const customLines = lines.filter((line) => getItem(line.itemId)?.isCustom);
  if (customLines.length > 0 && photos.length < 1) {
    return {
      ok: false,
      status: 422,
      error: "Для своего блюда нужно хотя бы одно фото.",
      fieldErrors: { photos: "Приложите фото-референс для своего блюда." },
    };
  }

  const calculation = calculateOrder(lines, settings.pricing, {
    deliveryMethod: input.deliveryMethod,
    outOfTown: input.outOfTown,
  });
  if (calculation.invalidKeys.length > 0 || calculation.lines.length !== lines.length) {
    return {
      ok: false,
      status: 422,
      error: "Часть блюд больше недоступна. Обновите корзину.",
      fieldErrors: { items: "Обновите состав заказа." },
    };
  }

  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) {
    return {
      ok: false,
      status: 422,
      error: "Проверьте телефон.",
      fieldErrors: { phone: "Укажите российский номер телефона." },
    };
  }

  const createdAt = new Date();
  const snapshot: PricingSnapshot = {
    ...settings.pricing,
    capturedAt: createdAt.toISOString(),
  };
  const totals: StoredTotals = {
    knownFood: calculation.knownFood,
    minOrder: calculation.minOrder,
    minUplift: calculation.minUplift,
    foodCharged: calculation.foodCharged,
    deliveryFee: calculation.deliveryFee,
    outOfTownFee: calculation.outOfTownFee,
    totalKnown: calculation.totalKnown,
    hasQuote: calculation.hasQuote,
    quoteCount: calculation.quoteCount,
    quoteItems: calculation.quoteItems,
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const id = randomUUID();
    const orderNo = orderNumber(timezone, createdAt);
    const token = publicToken();
    try {
      await db.transaction(async (tx) => {
        await tx.insert(orders).values({
          id,
          orderNo,
          publicToken: token,
          idempotencyKey: input.idempotencyKey,
          status: "new",
          customerName: input.customerName.trim(),
          phone: normalizedPhone,
          deliveryMethod: input.deliveryMethod,
          address: input.deliveryMethod === "delivery" ? input.address.trim() : null,
          outOfTown: input.deliveryMethod === "delivery" ? input.outOfTown : false,
          preferredDate: input.preferredDate || null,
          preferredTime: input.preferredTime || null,
          comment: input.comment?.trim() || null,
          consentAt: createdAt,
          items: calculation.lines,
          pricingSnapshot: snapshot,
          totals,
          knownSubtotal: calculation.knownFood,
          totalKnown: calculation.totalKnown,
          hasQuote: calculation.hasQuote,
          createdAt,
          updatedAt: createdAt,
        });
        if (photos.length > 0) {
          await tx.insert(orderPhotos).values(
            photos.map((photo) => ({
              id: randomUUID(),
              orderId: id,
              mime: photo.mime,
              width: photo.width,
              height: photo.height,
              bytes: photo.bytes,
              thumb: photo.thumb,
              createdAt,
            })),
          );
        }
        await tx.insert(orderEvents).values({
          id: randomUUID(),
          orderId: id,
          type: "created",
          payload: { status: "new" },
          createdAt,
        });
      });
      return { ok: true, token, orderNo, idempotent: false };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const duplicate = await db
          .select({ token: orders.publicToken, orderNo: orders.orderNo })
          .from(orders)
          .where(eq(orders.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (duplicate[0]) {
          return {
            ok: true,
            token: duplicate[0].token,
            orderNo: duplicate[0].orderNo,
            idempotent: true,
          };
        }
      }
      if (attempt === 3) {
        console.error("[orders] create failed", error);
        return {
          ok: false,
          status: 500,
          error: "Не удалось сохранить заказ. Попробуйте ещё раз — данные останутся в форме.",
        };
      }
    }
  }

  return { ok: false, status: 500, error: "Не удалось создать заказ." };
}

function validatePreferredTime(
  date: string,
  time: string,
  timeZone: string,
): string | null {
  if (!date) return null;
  const today = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
  if (date < today) return "Дата уже прошла. Выберите другой день.";
  if (date === today && time) {
    const now = formatInTimeZone(new Date(), timeZone, "HH:mm");
    if (time <= now) return "Это время уже прошло. Выберите более позднее.";
  }
  return null;
}

export async function getOrderByToken(token: string): Promise<PublicOrder | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const db = await getDb();
  const rows = await db.select().from(orders).where(eq(orders.publicToken, token)).limit(1);
  const order = rows[0];
  if (!order) return null;

  const [photoRows, eventRows, bonusRows, settings] = await Promise.all([
    db
      .select({ id: orderPhotos.id, width: orderPhotos.width, height: orderPhotos.height })
      .from(orderPhotos)
      .where(eq(orderPhotos.orderId, order.id))
      .orderBy(orderPhotos.createdAt),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(orderEvents.createdAt),
    db.select().from(bonusCodes).where(eq(bonusCodes.orderId, order.id)).limit(1),
    getAppSettings(),
  ]);

  const bonus = bonusRows[0];
  return {
    orderNo: order.orderNo,
    status: order.status,
    statusLabel: statusLabel(order.status),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    customerName: order.customerName,
    phone: order.phone,
    deliveryMethod: order.deliveryMethod,
    address: order.address,
    outOfTown: order.outOfTown,
    preferredDate: order.preferredDate,
    preferredTime: order.preferredTime,
    comment: order.comment,
    items: order.items,
    totals: order.totals,
    finalTotal: order.finalTotal,
    agreedAt: order.agreedAt?.toISOString() ?? null,
    hasQuote: order.hasQuote,
    photos: photoRows,
    events: publicEvents(eventRows),
    bonus: bonus ? mapBonus(bonus) : null,
    gameMode: settings.game.mode,
    timezone: settings.company.timezone,
  };
}

function publicEvents(events: OrderEventRow[]): PublicOrderEvent[] {
  const labels: Record<string, string> = {
    created: "Заказ принят",
    status_changed: "Статус обновлён",
    bonus_issued: "Бонус выдан",
    bonus_redeemed: "Бонус использован",
  };
  return events
    .filter((event) => Boolean(labels[event.type]))
    .map((event) => {
      let label = labels[event.type]!;
      if (event.type === "status_changed" && event.payload.to) {
        label = `Статус: ${statusLabel(String(event.payload.to))}`;
      }
      return {
        type: event.type,
        label,
        createdAt: event.createdAt.toISOString(),
      };
    });
}

function mapBonus(bonus: BonusCodeRow): PublicBonus {
  return {
    code: bonus.code,
    amount: bonus.amount,
    minOrder: bonus.minOrder,
    status: bonus.status,
    expiresAt: bonus.expiresAt.toISOString(),
  };
}

export async function getOrderPhoto(
  orderToken: string | null,
  photoId: string,
  orderId?: string,
): Promise<{ bytes: Buffer; mime: string } | null> {
  const db = await getDb();
  let resolvedOrderId = orderId;
  if (!resolvedOrderId && orderToken) {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(orderToken)) return null;
    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.publicToken, orderToken))
      .limit(1);
    resolvedOrderId = rows[0]?.id;
  }
  if (!resolvedOrderId) return null;
  const rows = await db
    .select()
    .from(orderPhotos)
    .where(and(eq(orderPhotos.id, photoId), eq(orderPhotos.orderId, resolvedOrderId)))
    .limit(1);
  const photo = rows[0];
  if (!photo) return null;
  return { bytes: Buffer.from(photo.bytes), mime: photo.mime };
}

export interface AdminOrderListFilters {
  q?: string;
  status?: string;
}

export async function listAdminOrders(filters: AdminOrderListFilters) {
  const db = await getDb();
  const q = filters.q?.trim().slice(0, 80) ?? "";
  const status = filters.status && filters.status !== "all" ? filters.status : "";
  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(orders.orderNo, `%${q}%`),
        ilike(orders.customerName, `%${q}%`),
        ilike(orders.phone, `%${q}%`),
        ilike(orders.address, `%${q}%`),
      ),
    );
  }
  if (status) {
    conditions.push(eq(orders.status, status));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      status: orders.status,
      customerName: orders.customerName,
      phone: orders.phone,
      deliveryMethod: orders.deliveryMethod,
      address: orders.address,
      outOfTown: orders.outOfTown,
      totalKnown: orders.totalKnown,
      finalTotal: orders.finalTotal,
      hasQuote: orders.hasQuote,
      createdAt: orders.createdAt,
      preferredDate: orders.preferredDate,
      preferredTime: orders.preferredTime,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(200);

  const countsRows = await db
    .select({ status: orders.status, value: count() })
    .from(orders)
    .groupBy(orders.status);
  const counts: Record<string, number> = {
    all: 0,
    new: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const row of countsRows) {
    counts[row.status] = Number(row.value);
    counts.all += Number(row.value);
  }

  return { rows, counts };
}

export async function getAdminOrder(id: string) {
  if (!/^[a-f0-9-]{20,40}$/i.test(id)) return null;
  const db = await getDb();
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const order = rows[0];
  if (!order) return null;
  const [photos, events, bonus] = await Promise.all([
    db
      .select()
      .from(orderPhotos)
      .where(eq(orderPhotos.orderId, id))
      .orderBy(orderPhotos.createdAt),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, id))
      .orderBy(desc(orderEvents.createdAt)),
    db.select().from(bonusCodes).where(eq(bonusCodes.orderId, id)).limit(1),
  ]);
  return { order, photos, events, bonus: bonus[0] ?? null };
}

export interface UpdateOrderInput {
  status: "new" | "confirmed" | "completed" | "cancelled";
  finalTotal?: number | null;
  agreedAtLocal?: string | null;
  adminNote?: string | null;
}

export async function updateOrder(
  id: string,
  input: UpdateOrderInput,
): Promise<{ ok: true } | ServiceFailure> {
  const db = await getDb();
  const settings = await getAppSettings();
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const order = rows[0];
  if (!order) return { ok: false, status: 404, error: "Заказ не найден." };

  const allowed: Record<string, string[]> = {
    new: ["new", "confirmed", "cancelled"],
    confirmed: ["confirmed", "completed", "cancelled"],
    completed: ["completed"],
    cancelled: ["cancelled"],
  };
  if (!allowed[order.status]?.includes(input.status)) {
    return {
      ok: false,
      status: 422,
      error: `Из статуса «${statusLabel(order.status)}» нельзя перейти в «${statusLabel(input.status)}».`,
    };
  }

  const finalTotal =
    input.finalTotal === undefined ? order.finalTotal : input.finalTotal;
  let agreedAt = order.agreedAt;
  if (input.agreedAtLocal !== undefined) {
    if (!input.agreedAtLocal) {
      agreedAt = null;
    } else {
      const parsed = localDateTimeToUtc(input.agreedAtLocal, settings.company.timezone);
      if (!parsed) {
        return {
          ok: false,
          status: 422,
          error: "Проверьте согласованное время.",
          fieldErrors: { agreedAtLocal: "Укажите дату и время." },
        };
      }
      agreedAt = parsed;
    }
  }

  if (input.status === "confirmed") {
    if (!finalTotal || finalTotal <= 0) {
      return {
        ok: false,
        status: 422,
        error: "Для подтверждения укажите итоговую цену.",
        fieldErrors: { finalTotal: "Итоговая цена обязательна." },
      };
    }
    if (!agreedAt) {
      return {
        ok: false,
        status: 422,
        error: "Для подтверждения укажите согласованное время.",
        fieldErrors: { agreedAtLocal: "Согласованное время обязательно." },
      };
    }
  }

  const note =
    input.adminNote === undefined ? order.adminNote : input.adminNote?.trim() || null;
  const now = new Date();
  const statusChanged = input.status !== order.status;
  const priceChanged = finalTotal !== order.finalTotal;
  const timeChanged = (agreedAt?.getTime() ?? 0) !== (order.agreedAt?.getTime() ?? 0);
  const noteChanged = note !== order.adminNote;

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: input.status, finalTotal, agreedAt, adminNote: note, updatedAt: now })
      .where(eq(orders.id, id));

    const events: Array<typeof orderEvents.$inferInsert> = [];
    if (statusChanged) {
      events.push({
        id: randomUUID(),
        orderId: id,
        type: "status_changed",
        payload: {
          from: order.status,
          to: input.status,
          finalTotal,
          agreedAt: agreedAt?.toISOString() ?? null,
        },
        createdAt: now,
      });
    }
    if (priceChanged || timeChanged) {
      events.push({
        id: randomUUID(),
        orderId: id,
        type: "terms_changed",
        payload: {
          finalTotal,
          agreedAt: agreedAt?.toISOString() ?? null,
        },
        createdAt: now,
      });
    }
    if (noteChanged) {
      events.push({
        id: randomUUID(),
        orderId: id,
        type: "note_changed",
        payload: {},
        createdAt: now,
      });
    }
    if (events.length > 0) await tx.insert(orderEvents).values(events);
  });

  return { ok: true };
}

export async function deleteOrder(
  id: string,
  confirm: string,
  acknowledgedPhotos = false,
): Promise<{ ok: true } | ServiceFailure> {
  const db = await getDb();
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const order = rows[0];
  if (!order) return { ok: false, status: 404, error: "Заказ не найден." };
  if (confirm.trim().toUpperCase() !== order.orderNo.toUpperCase()) {
    return {
      ok: false,
      status: 422,
      error: "Введите номер заказа, чтобы подтвердить удаление.",
      fieldErrors: { confirm: "Номер не совпадает." },
    };
  }
  const photoRows = await db
    .select({ id: orderPhotos.id })
    .from(orderPhotos)
    .where(eq(orderPhotos.orderId, id))
    .limit(1);
  if (photoRows.length > 0 && !acknowledgedPhotos) {
    return {
      ok: false,
      status: 422,
      error: "Подтвердите, что фотографии тоже будут удалены.",
      fieldErrors: { acknowledgedPhotos: "Нужно подтверждение удаления фото." },
    };
  }
  await db.delete(orders).where(eq(orders.id, id));
  return { ok: true };
}

export async function completeGame(token: string): Promise<
  | { ok: true; mode: "off" | "play" | "bonus"; bonus: PublicBonus | null }
  | ServiceFailure
> {
  const db = await getDb();
  const settings = await getAppSettings();
  if (settings.game.mode === "off") {
    return { ok: false, status: 403, error: "Игра сейчас отключена." };
  }
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
    return { ok: false, status: 404, error: "Заказ не найден." };
  }
  const rows = await db.select().from(orders).where(eq(orders.publicToken, token)).limit(1);
  const order = rows[0];
  if (!order) return { ok: false, status: 404, error: "Заказ не найден." };
  if (order.status !== "completed") {
    return {
      ok: false,
      status: 409,
      error: "Игра откроется после того, как заказ будет выполнен.",
    };
  }

  if (settings.game.mode === "play") {
    return { ok: true, mode: "play", bonus: null };
  }

  const existing = await db
    .select()
    .from(bonusCodes)
    .where(eq(bonusCodes.orderId, order.id))
    .limit(1);
  if (existing[0]) {
    return { ok: true, mode: "bonus", bonus: mapBonus(existing[0]) };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + settings.game.bonusDays * 24 * 60 * 60 * 1000);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const code = bonusCode(settings.game.codePrefix);
      const id = randomUUID();
      await db.transaction(async (tx) => {
        await tx.insert(bonusCodes).values({
          id,
          orderId: order.id,
          code,
          amount: settings.game.bonusAmount,
          minOrder: settings.game.bonusMinOrder,
          status: "issued",
          expiresAt,
          createdAt: now,
        });
        await tx.insert(orderEvents).values({
          id: randomUUID(),
          orderId: order.id,
          type: "bonus_issued",
          payload: { code, amount: settings.game.bonusAmount },
          createdAt: now,
        });
      });
      return {
        ok: true,
        mode: "bonus",
        bonus: {
          code,
          amount: settings.game.bonusAmount,
          minOrder: settings.game.bonusMinOrder,
          status: "issued",
          expiresAt: expiresAt.toISOString(),
        },
      };
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 3) {
        console.error("[game] bonus failed", error);
        return {
          ok: false,
          status: 500,
          error: "Не удалось выдать бонус. Попробуйте позже.",
        };
      }
    }
  }
  return { ok: false, status: 500, error: "Не удалось выдать бонус." };
}

export async function redeemBonus(code: string): Promise<{ ok: true } | ServiceFailure> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bonusCodes)
    .where(and(eq(bonusCodes.code, code), eq(bonusCodes.status, "issued")))
    .limit(1);
  const bonus = rows[0];
  if (!bonus) {
    return { ok: false, status: 404, error: "Бонус не найден или уже использован." };
  }
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(bonusCodes)
      .set({ status: "redeemed", redeemedAt: now })
      .where(eq(bonusCodes.id, bonus.id));
    await tx.insert(orderEvents).values({
      id: randomUUID(),
      orderId: bonus.orderId,
      type: "bonus_redeemed",
      payload: { code: bonus.code },
      createdAt: now,
    });
  });
  return { ok: true };
}

export async function countOrders(): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ value: count() }).from(orders);
  return Number(rows[0]?.value ?? 0);
}
