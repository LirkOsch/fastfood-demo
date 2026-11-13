import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getOrderPhoto } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) return new NextResponse("Нужен вход", { status: 401 });
  const { id, photoId } = await params;
  const photo = await getOrderPhoto(null, photoId, id);
  if (!photo) return new NextResponse("Фото не найдено", { status: 404 });
  return new NextResponse(new Uint8Array(photo.bytes), {
    status: 200,
    headers: {
      "Content-Type": photo.mime,
      "Content-Length": String(photo.bytes.byteLength),
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": 'inline; filename="photo.webp"',
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
