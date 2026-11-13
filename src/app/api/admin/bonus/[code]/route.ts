import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { checkRequestOrigin } from "@/lib/origin";
import { redeemBonus } from "@/lib/orders";
import { bonusRedeemSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const origin = checkRequestOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: origin.reason }, { status: 403 });
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Нужен вход." }, { status: 401 });
  try {
    await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }
  const parsed = bonusRedeemSchema.safeParse({ status: "redeemed" });
  if (!parsed.success) return NextResponse.json({ error: "Ошибка." }, { status: 422 });
  const { code } = await params;
  const result = await redeemBonus(code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
