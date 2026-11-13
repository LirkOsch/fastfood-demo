import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSettings } from "@/lib/db";
import { deliveryLabel, formatDateTime } from "@/lib/format";
import { getOrderByToken, type PublicOrder } from "@/lib/orders";
import { checkRequestOrigin } from "@/lib/origin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { answerAssistant } from "@/lib/assistant/brain";
import { extractOrderToken } from "@/lib/assistant/knowledge";
import { askLlm, llmEnabled } from "@/lib/assistant/llm";
import type { AssistantOrderInfo, OrderLookup } from "@/lib/assistant/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(600),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(600),
      }),
    )
    .max(8)
    .optional(),
});

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function summarizeOrder(order: PublicOrder, token: string): AssistantOrderInfo {
  return {
    orderNo: order.orderNo,
    status: order.status,
    statusLabel: order.statusLabel,
    totalKnown: order.totals.totalKnown,
    finalTotal: order.finalTotal,
    hasQuote: order.hasQuote,
    agreedAtLabel: order.agreedAt
      ? formatDateTime(order.agreedAt, order.timezone)
      : null,
    deliveryLabel: deliveryLabel(order.deliveryMethod),
    createdAtLabel: formatDateTime(order.createdAt, order.timezone),
    url: `/order/${token}`,
  };
}

export async function POST(request: Request) {
  const origin = checkRequestOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.reason }, { status: 403 });
  }

  const limited = rateLimit(
    `assistant:${clientIp(request)}`,
    intFromEnv("ASSISTANT_RATE_LIMIT", 60),
    5 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: "Слишком много сообщений подряд. Подождите минуту и попробуйте снова.",
      },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Сообщение пустое или слишком длинное (до 600 символов)." },
      { status: 422 },
    );
  }

  const settings = await getAppSettings();
  const token = extractOrderToken(parsed.data.message);

  let order: OrderLookup = { kind: "none" };
  if (token) {
    try {
      const found = await getOrderByToken(token);
      order = found
        ? { kind: "found", order: summarizeOrder(found, token) }
        : { kind: "not-found" };
    } catch {
      order = { kind: "not-found" };
    }
  } else if (/\/order\//.test(parsed.data.message)) {
    order = { kind: "not-found" };
  }

  let reply = answerAssistant(parsed.data.message, { settings, order });

  // LLM подключается только там, где локальное ядро не уверено в ответе.
  if (reply.intent === "fallback" && llmEnabled()) {
    const text = await askLlm({
      message: parsed.data.message,
      history: parsed.data.history ?? [],
      settings,
    });
    if (text) {
      reply = { ...reply, text, bullets: undefined, source: "llm" };
    }
  }

  return NextResponse.json(
    { reply },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
