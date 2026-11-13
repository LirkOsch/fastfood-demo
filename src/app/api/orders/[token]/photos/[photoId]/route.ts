import { NextResponse } from "next/server";
import { getOrderPhoto } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; photoId: string }> },
) {
  const { token, photoId } = await params;
  const photo = await getOrderPhoto(token, photoId);
  if (!photo) {
    return new NextResponse("Фото не найдено", { status: 404 });
  }
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
      "Referrer-Policy": "no-referrer",
    },
  });
}
