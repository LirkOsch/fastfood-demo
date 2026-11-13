import { DEFAULT_PRICING, sanitizePricing, type PricingSettings } from "./pricing";

export interface CompanySettings {
  name: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  city: string;
  deliveryArea: string;
  address: string;
  workingHours: string;
  accent: string;
  timezone: string;
  legalName: string;
}

export interface GameSettings {
  mode: "off" | "play" | "bonus";
  bonusAmount: number;
  bonusDays: number;
  bonusMinOrder: number;
  codePrefix: string;
}

export interface CharacterSettings {
  preset: "boxy" | "bun" | "none";
  faces: boolean;
  phrases: boolean;
  name: string;
}

export interface AppSettings {
  company: CompanySettings;
  pricing: PricingSettings;
  game: GameSettings;
  character: CharacterSettings;
}

export const DEFAULT_COMPANY: CompanySettings = {
  name: "Тёплый бокс",
  tagline: "Горячо. Быстро. По-соседски.",
  description:
    "Небольшая кухня быстрого питания: бургеры, шаурма, пицца и домашние напитки. Принимаем заказы на доставку и самовывоз, цену и время подтверждаем после короткого разговора.",
  phone: "",
  email: "hello@teplybox.example",
  city: "Сарапул",
  deliveryArea: "Сарапул и ближайшие районы",
  address: "Сарапул, ул. Тёплая, 12 (демо-адрес)",
  workingHours: "Ежедневно, 10:00–22:00",
  accent: "#E2542C",
  timezone: "Europe/Samara",
  legalName: "Демо-проект «Тёплый бокс»",
};

export const DEFAULT_GAME: GameSettings = {
  mode: "bonus",
  bonusAmount: 200,
  bonusDays: 14,
  bonusMinOrder: 700,
  codePrefix: "BOX",
};

export const DEFAULT_CHARACTER: CharacterSettings = {
  preset: "boxy",
  faces: true,
  phrases: true,
  name: "Боксик",
};

export const DEFAULT_SETTINGS: AppSettings = {
  company: DEFAULT_COMPANY,
  pricing: DEFAULT_PRICING,
  game: DEFAULT_GAME,
  character: DEFAULT_CHARACTER,
};

export function sanitizeCompany(
  input: Partial<CompanySettings> | null | undefined,
): CompanySettings {
  return {
    name: cleanText(input?.name, DEFAULT_COMPANY.name, 60),
    tagline: cleanText(input?.tagline, DEFAULT_COMPANY.tagline, 100),
    description: cleanText(input?.description, DEFAULT_COMPANY.description, 800),
    phone: cleanPhone(input?.phone),
    email: cleanEmail(input?.email),
    city: cleanText(input?.city, DEFAULT_COMPANY.city, 80),
    deliveryArea: cleanText(input?.deliveryArea, DEFAULT_COMPANY.deliveryArea, 160),
    address: cleanText(input?.address, DEFAULT_COMPANY.address, 160),
    workingHours: cleanText(input?.workingHours, DEFAULT_COMPANY.workingHours, 120),
    accent: normalizeHex(input?.accent, DEFAULT_COMPANY.accent),
    timezone: cleanTimezone(input?.timezone),
    legalName: cleanText(input?.legalName, DEFAULT_COMPANY.legalName, 160),
  };
}

export function sanitizeGame(input: Partial<GameSettings> | null | undefined): GameSettings {
  const mode =
    input?.mode === "off" || input?.mode === "play" || input?.mode === "bonus"
      ? input.mode
      : DEFAULT_GAME.mode;
  return {
    mode,
    bonusAmount: clampInt(input?.bonusAmount, DEFAULT_GAME.bonusAmount, 0, 5000),
    bonusDays: clampInt(input?.bonusDays, DEFAULT_GAME.bonusDays, 1, 180),
    bonusMinOrder: clampInt(input?.bonusMinOrder, DEFAULT_GAME.bonusMinOrder, 0, 100000),
    codePrefix:
      cleanText(input?.codePrefix, DEFAULT_GAME.codePrefix, 8)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") || DEFAULT_GAME.codePrefix,
  };
}

export function sanitizeCharacter(
  input: Partial<CharacterSettings> | null | undefined,
): CharacterSettings {
  const preset =
    input?.preset === "boxy" || input?.preset === "bun" || input?.preset === "none"
      ? input.preset
      : DEFAULT_CHARACTER.preset;
  return {
    preset,
    faces: typeof input?.faces === "boolean" ? input.faces : DEFAULT_CHARACTER.faces,
    phrases:
      typeof input?.phrases === "boolean" ? input.phrases : DEFAULT_CHARACTER.phrases,
    name: cleanText(input?.name, DEFAULT_CHARACTER.name, 40),
  };
}

export function mergeSettings(
  company: unknown,
  pricing: unknown,
  game: unknown,
  character: unknown,
): AppSettings {
  return {
    company: sanitizeCompany((company ?? {}) as Partial<CompanySettings>),
    pricing: sanitizePricing((pricing ?? {}) as Partial<PricingSettings>),
    game: sanitizeGame((game ?? {}) as Partial<GameSettings>),
    character: sanitizeCharacter((character ?? {}) as Partial<CharacterSettings>),
  };
}

export function accentInk(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.48 ? "#1c1814" : "#ffffff";
}

export function accentSoft(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "rgba(226, 84, 44, 0.12)";
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.12)`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeHex(hex, "#000000").slice(1);
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const number = Number.parseInt(full, 16);
  if (!Number.isFinite(number)) return null;
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

export function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed.toLowerCase();
  return fallback;
}

function cleanText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.slice(0, max);
}

function cleanPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text) return "";
  return /^[+0-9()\-\s]{5,25}$/.test(text) ? text.slice(0, 25) : "";
}

function cleanEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim().toLowerCase().slice(0, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : "";
}

function cleanTimezone(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_COMPANY.timezone;
  try {
    new Intl.DateTimeFormat("ru-RU", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_COMPANY.timezone;
  }
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}
