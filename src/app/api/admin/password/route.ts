import { NextResponse } from "next/server";
import { changePassword, requireAdminApi, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { checkRequestOrigin } from "@/lib/origin";
import { passwordSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Новый пароль должен быть не короче 10 символов." },
      { status: 422 },
    );
  }

  const result = await changePassword(
    admin.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });

  const response = NextResponse.json({ ok: true, reauth: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
