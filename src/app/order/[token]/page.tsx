import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderView } from "@/components/order/OrderView";
import { getAppSettings } from "@/lib/db";
import { getOrderByToken } from "@/lib/orders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Приватная страница заказа",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const [order, settings] = await Promise.all([
    getOrderByToken(token),
    getAppSettings(),
  ]);
  if (!order) notFound();

  return (
    <OrderView
      initial={order}
      token={token}
      company={settings.company}
      created={query.created === "1"}
    />
  );
}
