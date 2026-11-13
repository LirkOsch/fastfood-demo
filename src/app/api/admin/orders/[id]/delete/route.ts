import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { checkRequestOrigin } from "@/lib/origin";
import { deleteOrder } from "@/lib/orders";
import { deleteOrderSchema, fieldErrors } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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
  const parsed = deleteOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте подтверждение.", fieldErrors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const { id } = await params;
  const result = await deleteOrder(
    id,
    parsed.data.confirm,
    parsed.data.acknowledgedPhotos === true,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, fieldErrors: result.fieldErrors },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true });
}
