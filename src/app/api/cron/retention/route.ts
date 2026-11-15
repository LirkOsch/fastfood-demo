import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { purgeOldOrders, retentionDays } from "@/lib/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function providedSecret(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return new URL(request.url).searchParams.get("secret")?.trim() ?? "";
}

/**
 * Ежедневная уборка: удаляет заказы и фото старше RETENTION_DAYS.
 * Запускается по расписанию Vercel (см. vercel.json) и только с секретом.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim() ?? "";
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "Автоочистка выключена: задайте CRON_SECRET в переменных окружения проекта.",
      },
      { status: 503 },
    );
  }
  if (!sameSecret(providedSecret(request), expected)) {
    return NextResponse.json({ error: "Нужен секрет." }, { status: 401 });
  }

  const days = retentionDays();
  try {
    const deleted = await purgeOldOrders(days);
    console.info(`[retention] удалено заказов: ${deleted}, срок хранения ${days} дн.`);
    return NextResponse.json(
      { ok: true, deleted, days, at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[retention] не удалось очистить заказы", error);
    return NextResponse.json({ error: "Не удалось выполнить очистку." }, { status: 500 });
  }
}
