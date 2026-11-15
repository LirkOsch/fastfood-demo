"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { playChime } from "@/lib/client/sound";

export interface OrderPulseData {
  latest: string | null;
  latestOrderNo: string | null;
  newCount: number;
  total: number;
}

export interface FreshOrder {
  orderNo: string;
  /** Сколько новых заказов было на момент сигнала. */
  newCount: number;
}

/** Как часто проверяем новые заказы. Дешёвый запрос, поэтому можно часто. */
export const PULSE_INTERVAL_MS = 15_000;

/**
 * Следит за новыми заказами, пока открыт кабинет.
 *
 * Первый успешный ответ только запоминает состояние — уведомлять о заказах,
 * которые были до открытия страницы, не нужно. Дальше любое изменение времени
 * самого свежего заказа считается новым заказом.
 */
export function useOrderPulse(soundEnabled: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<OrderPulseData | null>(null);
  const [fresh, setFresh] = useState<FreshOrder | null>(null);
  const [online, setOnline] = useState(true);
  const seen = useRef<string | null>(null);
  const pathRef = useRef(pathname);
  const soundRef = useRef(soundEnabled);

  pathRef.current = pathname;
  soundRef.current = soundEnabled;

  useEffect(() => {
    let stopped = false;

    const tick = async () => {
      try {
        const response = await fetch("/api/admin/orders/pulse", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) {
          if (response.status === 401) setOnline(false);
          return;
        }
        const next = (await response.json()) as OrderPulseData;
        if (stopped) return;
        setOnline(true);
        setData(next);

        const previous = seen.current;
        seen.current = next.latest;
        if (previous && next.latest && next.latest !== previous) {
          setFresh({ orderNo: next.latestOrderNo ?? "", newCount: next.newCount });
          if (soundRef.current) playChime();
          if (pathRef.current.startsWith("/admin/orders")) router.refresh();
        }
      } catch {
        // Сеть пропала — попробуем на следующем тике, кабинет продолжает работать.
      }
    };

    void tick();
    const timer = window.setInterval(() => {
      if (!document.hidden) void tick();
    }, PULSE_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  useEffect(() => {
    if (!fresh) return;
    const timer = window.setTimeout(() => setFresh(null), 25_000);
    return () => window.clearTimeout(timer);
  }, [fresh]);

  return {
    data,
    fresh,
    online,
    dismiss: () => setFresh(null),
  };
}
