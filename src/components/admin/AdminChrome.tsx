"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BoxMark } from "@/components/site/BoxMark";

type NavIcon =
  | "home"
  | "orders"
  | "menu"
  | "store"
  | "game"
  | "face"
  | "lock";

type IconName = NavIcon | "logout" | "external";

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

const groups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Работа",
    items: [
      { href: "/admin", label: "Обзор", icon: "home" },
      { href: "/admin/orders", label: "Заказы", icon: "orders" },
    ],
  },
  {
    label: "Настройки",
    items: [
      { href: "/admin/menu", label: "Меню и цены", icon: "menu" },
      { href: "/admin/company", label: "Компания", icon: "store" },
      { href: "/admin/game", label: "Игра и бонусы", icon: "game" },
      { href: "/admin/characters", label: "Персонаж", icon: "face" },
    ],
  },
  {
    label: "Аккаунт",
    items: [{ href: "/admin/access", label: "Доступ", icon: "lock" }],
  },
];

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <path d="M4 10 12 3l8 7v10a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1V10Z" />,
    orders: <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
    menu: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="8" cy="5" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="10" cy="19" r="1.4" /></>,
    store: <><path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" /><path d="M3 10 5 4h14l2 6" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
    game: <><rect x="3" y="7" width="18" height="10" rx="5" /><path d="M8 10v4M6 12h4" /><circle cx="16.5" cy="11" r="1" /><circle cx="18.5" cy="13.5" r="1" /></>,
    face: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14c2 2 5 2 7 0" /><circle cx="9" cy="10" r="1" /><circle cx="15" cy="10" r="1" /></>,
    lock: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    logout: <><path d="M9 5H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" /><path d="M14 8l5 4-5 4M19 12H9" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminChrome({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
    } catch {
      // cookie всё равно удалим на клиенте переходом на форму входа
    }
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-side__brand">
          <Link href="/admin" className="brand">
            <BoxMark className="brand__mark" />
            <span className="brand__text">
              {user.name}
              <small>Кабинет владельца</small>
            </span>
          </Link>
        </div>

        <nav className="admin-nav" aria-label="Кабинет">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="admin-nav__group">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive(pathname, item.href) ? "is-active" : undefined}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-side__foot">
          <div className="admin-user">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <Link href="/" className="btn btn--ghost btn--small btn--block" target="_blank">
            <Icon name="external" />
            Открыть сайт
          </Link>
          <button
            type="button"
            className="btn btn--ghost btn--small btn--block"
            onClick={() => void logout()}
            disabled={loggingOut}
          >
            <Icon name="logout" />
            {loggingOut ? "Выходим…" : "Выйти"}
          </button>
        </div>
      </aside>

      <div>
        <div className="admin-mobile-bar">
          <Link href="/admin" className="brand">
            <BoxMark className="brand__mark" />
            <span className="brand__text">Кабинет</span>
          </Link>
          <nav className="admin-mobile-bar__nav" aria-label="Кабинет">
            {groups.flatMap((group) => group.items).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(pathname, item.href) ? "is-active" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 34, height: 34, flex: "none" }}
            onClick={() => void logout()}
            aria-label="Выйти"
          >
            <Icon name="logout" />
          </button>
        </div>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
