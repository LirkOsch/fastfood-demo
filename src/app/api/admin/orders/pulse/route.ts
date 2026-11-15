import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { orderPulse } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Дешёвый опрос для живого кабинета: новые заказы без перезагрузки страницы. */
export async function GET() {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Нужен вход." }, { status: 401 });

  const pulse = await orderPulse();
  return NextResponse.json(pulse, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
