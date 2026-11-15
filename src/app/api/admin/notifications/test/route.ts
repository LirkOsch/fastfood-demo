import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { checkRequestOrigin } from "@/lib/origin";
import { notificationsConfigured, sendTelegramMessage } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = checkRequestOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: origin.reason }, { status: 403 });
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Нужен вход." }, { status: 401 });

  const limited = rateLimit(`notify-test:${clientIp(request)}`, 6, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите пару минут.", },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  if (!notificationsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Уведомления не настроены. Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменные окружения проекта и перезапустите деплой.",
      },
      { status: 503 },
    );
  }

  const result = await sendTelegramMessage(
    "🔔 <b>Проверка связи</b>\nУведомления «Тёплого бокса» работают: новые заказы придут в этот чат.",
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Не удалось отправить сообщение." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
