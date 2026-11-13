import { NextResponse } from "next/server";
import { SESSION_COOKIE, createAdminSession, sessionCookieOptions, verifyCredentials } from "@/lib/auth";
import { checkRequestOrigin } from "@/lib/origin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function POST(request: Request) {
  const origin = checkRequestOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: origin.reason }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Заполните e-mail и пароль." }, { status: 422 });
  }

  const ip = clientIp(request);
  // Значения по умолчанию рассчитаны на продакшн. Для демо и E2E их можно
  // поднять через ADMIN_LOGIN_IP_LIMIT / ADMIN_LOGIN_PAIR_LIMIT, чтобы серия
  // прогонов не блокировала вход самому владельцу.
  const ipLimitCount = intFromEnv("ADMIN_LOGIN_IP_LIMIT", 20);
  const pairLimitCount = intFromEnv("ADMIN_LOGIN_PAIR_LIMIT", 5);
  const ipLimit = rateLimit(`login-ip:${ip}`, ipLimitCount, 15 * 60 * 1000);
  const pairLimit = rateLimit(
    `login-pair:${ip}:${parsed.data.email.toLowerCase()}`,
    pairLimitCount,
    15 * 60 * 1000,
  );
  if (!ipLimit.ok || !pairLimit.ok) {
    return NextResponse.json(
      { error: "Слишком много попыток входа. Попробуйте через 15 минут." },
      { status: 429, headers: { "Retry-After": String(Math.max(ipLimit.retryAfterSeconds, pairLimit.retryAfterSeconds)) } },
    );
  }

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Неверный e-mail или пароль." }, { status: 401 });
  }

  const session = await createAdminSession(user.id, request.headers.get("user-agent"));
  const response = NextResponse.json({ ok: true, redirect: "/admin" });
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions());
  return response;
}
