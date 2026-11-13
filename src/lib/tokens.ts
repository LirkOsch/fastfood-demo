import { randomBytes } from "node:crypto";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function publicToken(): string {
  return randomBytes(24).toString("base64url");
}

export function orderNumber(timeZone: string, now = new Date()): string {
  const date = formatInTimeZone(now, timeZone, "yyMMdd");
  return `TB-${date}-${randomCode(4, TOKEN_ALPHABET)}`;
}

export function bonusCode(prefix: string): string {
  return `${prefix.toUpperCase()}-${randomCode(6, CODE_ALPHABET)}`;
}

function randomCode(length: number, alphabet: string): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += alphabet[bytes[index]! % alphabet.length];
  }
  return result;
}

export function localDateTimeToUtc(value: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  try {
    const result = fromZonedTime(`${value}:00`, timeZone);
    return Number.isNaN(result.getTime()) ? null : result;
  } catch {
    return null;
  }
}
