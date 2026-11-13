import { NextResponse } from "next/server";
import { checkRequestOrigin } from "@/lib/origin";
import { completeGame } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const origin = checkRequestOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.reason }, { status: 403 });
  }
  const gameLimit = intFromEnv("ORDER_GAME_LIMIT", 12);
  const limited = rateLimit(`game:${clientIp(request)}`, gameLimit, 5 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Слишком часто. Попробуйте через пару минут." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }
  const { token } = await params;
  const result = await completeGame(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
