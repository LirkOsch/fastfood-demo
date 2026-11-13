import type { CartLineInput } from "@/lib/pricing";
import type { AppSettings } from "@/lib/settings";

/** Короткие вопросы, которые помощник предлагает в начале диалога. */
export const STARTER_CHIPS = [
  "Что посоветуешь?",
  "Сколько стоит доставка?",
  "Покажи меню",
  "Как оформить заказ?",
];

export const STATUS_CHIPS = [
  "Где мой заказ?",
  "Сколько стоит доставка?",
  "Покажи меню",
];

export interface AssistantLink {
  href: string;
  label: string;
}

export interface AssistantAddAction {
  type: "add-to-cart";
  label: string;
  line: CartLineInput;
}

export interface AssistantReply {
  intent: string;
  text: string;
  bullets?: string[];
  chips?: string[];
  add?: AssistantAddAction;
  link?: AssistantLink;
  source: "local" | "llm";
}

export interface AssistantOrderInfo {
  orderNo: string;
  status: string;
  statusLabel: string;
  totalKnown: number;
  finalTotal: number | null;
  hasQuote: boolean;
  agreedAtLabel: string | null;
  deliveryLabel: string;
  createdAtLabel: string;
  url: string;
}

export type OrderLookup =
  | { kind: "none" }
  | { kind: "found"; order: AssistantOrderInfo }
  | { kind: "not-found" };

export interface AssistantContext {
  settings: AppSettings;
  order: OrderLookup;
}
