import { notFound } from "next/navigation";
import { AdminOrderDetail, type AdminOrderView } from "@/components/admin/AdminOrderDetail";
import { getAppSettings } from "@/lib/db";
import { formatDateTimeLocal } from "@/lib/format";
import { getAdminOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [settings, record] = await Promise.all([getAppSettings(), getAdminOrder(id)]);
  if (!record) notFound();

  const { order, photos, events, bonus } = record;
  const timezone = settings.company.timezone;

  const view: AdminOrderView = {
    id: order.id,
    orderNo: order.orderNo,
    publicToken: order.publicToken,
    status: order.status,
    customerName: order.customerName,
    phone: order.phone,
    deliveryMethod: order.deliveryMethod,
    address: order.address,
    outOfTown: order.outOfTown,
    preferredDate: order.preferredDate,
    preferredTime: order.preferredTime,
    comment: order.comment,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    finalTotal: order.finalTotal,
    agreedAtLocal: formatDateTimeLocal(order.agreedAt, timezone),
    adminNote: order.adminNote,
    items: order.items,
    totals: order.totals,
    photos: photos.map((photo) => ({
      id: photo.id,
      width: photo.width,
      height: photo.height,
    })),
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt.toISOString(),
      payload: event.payload as Record<string, unknown>,
    })),
    bonus: bonus
      ? {
          code: bonus.code,
          amount: bonus.amount,
          minOrder: bonus.minOrder,
          status: bonus.status,
          expiresAt: bonus.expiresAt.toISOString(),
        }
      : null,
    pricingCapturedAt: order.pricingSnapshot.capturedAt,
    timezone,
  };

  return <AdminOrderDetail order={view} />;
}
