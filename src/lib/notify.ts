/**
 * Уведомления владельцу о заказах.
 *
 * Канал — Telegram Bot API: владелец получает сообщение в чат сразу после
 * создания заказа и после подтверждения. Настройка через переменные окружения
 * TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID; без них модуль молча выключен, и сайт
 * работает как раньше.
 *
 * TELEGRAM_API_URL нужен только для тестов: он подменяет https://api.telegram.org.
 */

import { formatPhone, formatRub } from "@/lib/format";

const DEFAULT_API_URL = "https://api.telegram.org";
const TIMEOUT_MS = 5000;
const MAX_TEXT = 3900;

export interface OrderNoticeLine {
  name: string;
  variantLabel: string;
  qty: number;
  quote: boolean;
}

export interface OrderNotice {
  orderNo: string;
  customerName: string;
  phone: string;
  deliveryMethod: string;
  outOfTown: boolean;
  address: string | null;
  lines: OrderNoticeLine[];
  totalKnown: number;
  hasQuote: boolean;
  comment: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
}

export interface StatusNotice {
  orderNo: string;
  customerName: string;
  phone: string;
  status: string;
  finalTotal: number | null;
  agreedAtText: string | null;
}

interface TelegramConfig {
  token: string;
  chatId: string;
  apiUrl: string;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/** Телеграм-конфигурация или null, если уведомления не настроены. */
export function telegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;
  const apiUrl = (process.env.TELEGRAM_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");
  return { token, chatId, apiUrl };
}

export function notificationsConfigured(): boolean {
  return telegramConfig() !== null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function deliveryText(notice: Pick<OrderNotice, "deliveryMethod" | "outOfTown" | "address">): string {
  if (notice.deliveryMethod !== "delivery") return "Самовывоз";
  const suffix = notice.outOfTown ? " (за город)" : "";
  const address = notice.address ? `: ${escapeHtml(notice.address)}` : "";
  return `Доставка${suffix}${address}`;
}

function linesText(lines: OrderNoticeLine[], limit = 12): string {
  const shown = lines.slice(0, limit).map((line) => {
    const quote = line.quote ? " — цена по запросу" : "";
    return `${line.qty} × ${escapeHtml(line.name)} (${escapeHtml(line.variantLabel)})${quote}`;
  });
  if (lines.length > limit) shown.push(`…и ещё ${lines.length - limit} поз.`);
  return shown.join("\n");
}

export function buildNewOrderMessage(notice: OrderNotice, adminUrl: string): string {
  const when =
    notice.preferredDate || notice.preferredTime
      ? `\n🗓 ${escapeHtml([notice.preferredDate, notice.preferredTime].filter(Boolean).join(" "))}`
      : "";
  const comment = notice.comment ? `\n💬 ${escapeHtml(notice.comment)}` : "";
  const quote = notice.hasQuote ? " (есть позиции по запросу)" : "";
  const phone = escapeHtml(formatPhone(notice.phone));
  const body = [
    `🍔 <b>Новый заказ ${escapeHtml(notice.orderNo)}</b>`,
    `👤 ${escapeHtml(notice.customerName)} · ${phone}`,
    `🚗 ${deliveryText(notice)}`,
    `\n${linesText(notice.lines)}`,
    `\n💰 ${formatRub(notice.totalKnown)}${quote}`,
    comment + when,
    adminUrl ? `\n<a href="${escapeHtml(adminUrl)}">Открыть кабинет</a>` : "",
  ]
    .filter((chunk) => chunk !== "")
    .join("\n");
  return body.slice(0, MAX_TEXT);
}

const STATUS_TITLES: Record<string, string> = {
  confirmed: "✅ Заказ подтверждён",
  completed: "🏁 Заказ выполнен",
  cancelled: "⛔ Заказ отменён",
  new: "↩️ Заказ возвращён в работу",
};

export function buildStatusMessage(notice: StatusNotice, adminUrl: string): string {
  const title = STATUS_TITLES[notice.status] ?? "Статус заказа изменён";
  const total =
    notice.finalTotal && notice.finalTotal > 0 ? `\n💰 Итог: ${formatRub(notice.finalTotal)}` : "";
  const when = notice.agreedAtText ? `\n🗓 ${escapeHtml(notice.agreedAtText)}` : "";
  const body = [
    `<b>${title} ${escapeHtml(notice.orderNo)}</b>`,
    `👤 ${escapeHtml(notice.customerName)} · ${escapeHtml(formatPhone(notice.phone))}`,
    total + when,
    adminUrl ? `\n<a href="${escapeHtml(adminUrl)}">Открыть заказ</a>` : "",
  ]
    .filter((chunk) => chunk !== "")
    .join("\n");
  return body.slice(0, MAX_TEXT);
}

/** Отправляет текст в Telegram. Никогда не бросает исключение. */
export async function sendTelegramMessage(text: string): Promise<SendResult> {
  const config = telegramConfig();
  if (!config) {
    return {
      ok: false,
      error:
        "Уведомления не настроены: добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменные окружения.",
    };
  }
  try {
    const response = await fetch(`${config.apiUrl}/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: text.slice(0, MAX_TEXT),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).replaceAll(config.token, "***");
      return {
        ok: false,
        error: `Telegram ответил ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`,
      };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка сети";
    return { ok: false, error: message.replaceAll(config.token, "***") };
  }
}

export function appUrl(): string {
  const raw = process.env.APP_URL?.trim() || "";
  return raw.replace(/\/+$/, "");
}

export function adminOrderUrl(orderId: string): string {
  const base = appUrl();
  return base ? `${base}/admin/orders/${orderId}` : "";
}
