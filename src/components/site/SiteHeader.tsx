"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { BoxMark } from "@/components/site/BoxMark";
import { ThemeToggle } from "@/components/site/ThemeToggle";

export function SiteHeader({
  cartEnabled = true,
  compact = false,
}: {
  cartEnabled?: boolean;
  compact?: boolean;
}) {
  const { count, hydrated, openCart } = useCart();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="page header-inner">
        <Link href="/" className="brand" aria-label="Тёплый бокс — на главную">
          <BoxMark className="brand__mark" />
          <span className="brand__text">
            Тёплый бокс
            <small>Горячо. Быстро. По-соседски.</small>
          </span>
        </Link>

        {!compact ? (
          <nav className="site-nav" aria-label="Основная навигация">
            <Link href="/#menu">Меню</Link>
            <Link href="/#how">Как заказать</Link>
            <Link href="/#about">О кафе</Link>
            <Link href="/#contacts">Контакты</Link>
          </nav>
        ) : null}

        <div className="header-actions">
          <ThemeToggle />
          {cartEnabled ? (
            <button
              type="button"
              className="cart-button"
              onClick={openCart}
              aria-label={hydrated ? `Корзина, позиций: ${count}` : "Корзина"}
              data-testid="cart-button"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L21.5 7H6" />
                <circle cx="10" cy="20" r="1.3" />
                <circle cx="18" cy="20" r="1.3" />
              </svg>
              <span className="cart-button__label">Корзина</span>
              <span className="cart-button__count" data-testid="cart-count">
                {hydrated ? count : 0}
              </span>
            </button>
          ) : (
            <Link href="/#menu" className="btn btn--primary header-order">
              Меню
            </Link>
          )}
          {cartEnabled ? (
            <Link href="/checkout" className="btn btn--primary header-order">
              Оформить
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
