import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import {
  saveCharacter,
  saveCompany,
  saveGame,
  savePricing,
} from "@/lib/db";
import { checkRequestOrigin } from "@/lib/origin";
import {
  characterSchema,
  companySchema,
  fieldErrors,
  gameSchema,
  pricingSchema,
} from "@/lib/validation";
import { sanitizePricing, type PricingSettings } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECTIONS = new Set(["company", "pricing", "game", "character"]);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  const origin = checkRequestOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: origin.reason }, { status: 403 });
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Нужен вход." }, { status: 401 });

  const { section } = await params;
  if (!SECTIONS.has(section)) {
    return NextResponse.json({ error: "Неизвестный раздел." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  if (section === "company") {
    const parsed = companySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Проверьте поля компании.", fieldErrors: fieldErrors(parsed.error) },
        { status: 422 },
      );
    }
    await saveCompany(parsed.data);
    return NextResponse.json({ ok: true, section });
  }

  if (section === "pricing") {
    const parsed = pricingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Проверьте тарифы.", fieldErrors: fieldErrors(parsed.error) },
        { status: 422 },
      );
    }
    await savePricing(sanitizePricing(parsed.data as Partial<PricingSettings>));
    return NextResponse.json({ ok: true, section });
  }

  if (section === "game") {
    const parsed = gameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Проверьте настройки игры.", fieldErrors: fieldErrors(parsed.error) },
        { status: 422 },
      );
    }
    await saveGame(parsed.data);
    return NextResponse.json({ ok: true, section });
  }

  const parsed = characterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте настройки персонажа.", fieldErrors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  await saveCharacter(parsed.data);
  return NextResponse.json({ ok: true, section });
}
