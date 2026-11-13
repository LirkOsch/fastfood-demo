import type { Metadata } from "next";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Кабинет владельца",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminPage();
  return (
    <AdminChrome user={{ name: admin.name, email: admin.email }}>
      {children}
    </AdminChrome>
  );
}
