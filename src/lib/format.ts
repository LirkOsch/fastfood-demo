import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function formatRub(value: number): string {
  return rub.format(Math.round(value)).replace(/\u00A0/g, " ");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("8")
      ? `7${digits.slice(1)}`
      : digits.length === 11 && digits.startsWith("7")
        ? digits
        : digits.length === 10
          ? `7${digits}`
          : "";
  if (!normalized) return phone;
  return `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
}

export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) return `+7${digits}`;
  return null;
}

export function formatDateLong(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatDateTime(value: Date | string | null | undefined, timeZone: string): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, timeZone, "d MMMM, HH:mm", { locale: ru });
}

export function formatTime(value: Date | string | null | undefined, timeZone: string): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, timeZone, "HH:mm");
}

export function formatDateTimeLocal(value: Date | string | null | undefined, timeZone: string): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd'T'HH:mm");
}

export const STATUS_LABELS = {
  new: "Новый",
  confirmed: "Подтверждён",
  completed: "Выполнен",
  cancelled: "Отменён",
} as const;

export type OrderStatus = keyof typeof STATUS_LABELS;

export const STATUS_ORDER: OrderStatus[] = ["new", "confirmed", "completed"];

export const DELIVERY_LABELS = {
  delivery: "Доставка",
  pickup: "Самовывоз",
} as const;

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatus] ?? status;
}

export function deliveryLabel(method: string): string {
  return DELIVERY_LABELS[method as keyof typeof DELIVERY_LABELS] ?? method;
}
