import "server-only";
import { lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/db/schema";

export const DEFAULT_RETENTION_DAYS = 90;
export const MIN_RETENTION_DAYS = 1;
export const MAX_RETENTION_DAYS = 3650;

/**
 * Сколько дней храним заказы и фото.
 *
 * По умолчанию 90 дней — как обещано в политике конфиденциальности. Значение
 * задаётся переменной RETENTION_DAYS; мусорные значения заменяются на дефолт,
 * чтобы опечатка не удалила данные слишком рано.
 */
export function retentionDays(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env.RETENTION_DAYS);
  if (!Number.isFinite(raw) || raw < MIN_RETENTION_DAYS) return DEFAULT_RETENTION_DAYS;
  return Math.min(Math.round(raw), MAX_RETENTION_DAYS);
}

/**
 * Удаляет заказы старше указанного срока вместе с фото, историей и бонусами
 * (связанные записи уходят каскадом). Возвращает число удалённых заказов.
 */
export async function purgeOldOrders(days: number, now = new Date()): Promise<number> {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(orders)
    .where(lt(orders.createdAt, cutoff))
    .returning({ id: orders.id });
  return deleted.length;
}
