import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { checkRequestOrigin } from "@/lib/origin";
import { updateOrder } from "@/lib/orders";
import { fieldErrors, orderUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = checkRequestOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: origin.reason }, { status: 403 });
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Нужен вход." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }
  const parsed = orderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте поля заказа.", fieldErrors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { id } = await params;
  const result = await updateOrder(id, {
    status: parsed.data.status,
    finalTotal: parsed.data.finalTotal,
    agreedAtLocal:
      parsed.data.agreedAtLocal === "" ? null : parsed.data.agreedAtLocal,
    adminNote: parsed.data.adminNote,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, fieldErrors: result.fieldErrors },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true });
}
