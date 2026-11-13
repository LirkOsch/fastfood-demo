import { NextResponse } from "next/server";
import { checkRequestOrigin } from "@/lib/origin";
import { createOrder } from "@/lib/orders";
import { processPhotos } from "@/lib/images";
import { createOrderSchema, fieldErrors } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = checkRequestOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.reason }, { status: 403 });
  }

  const limited = rateLimit(`order:${clientIp(request)}`, 12, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Слишком много попыток. Подождите пару минут и попробуйте снова." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "Слишком большой запрос." }, { status: 413 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Ожидается multipart/form-data с полем payload." },
      { status: 415 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать форму." }, { status: 400 });
  }

  const rawPayload = form.get("payload");
  if (typeof rawPayload !== "string" || rawPayload.length > 60000) {
    return NextResponse.json({ error: "Некорректные данные заказа." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return NextResponse.json({ error: "Некорректный JSON заказа." }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Проверьте форму.",
        fieldErrors: fieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const rawFiles = form.getAll("photos").filter((value): value is File => value instanceof File);
  const processed = await processPhotos(rawFiles);
  if (!processed.ok) {
    return NextResponse.json(
      {
        error: processed.error,
        fieldErrors: { photos: processed.error },
        photoIndex: processed.index,
      },
      { status: 422 },
    );
  }

  const result = await createOrder(parsed.data, processed.photos);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, fieldErrors: result.fieldErrors },
      { status: result.status },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      token: result.token,
      orderNo: result.orderNo,
      idempotent: result.idempotent,
      url: `/order/${result.token}`,
    },
    {
      status: result.idempotent ? 200 : 201,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
