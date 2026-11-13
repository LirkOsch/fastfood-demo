import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { PricedLine } from "@/lib/pricing";
import type { PricingSettings } from "@/lib/pricing";
import type {
  CharacterSettings,
  CompanySettings,
  GameSettings,
} from "@/lib/settings";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

export interface StoredTotals {
  knownFood: number;
  minOrder: number;
  minUplift: number;
  foodCharged: number;
  deliveryFee: number;
  outOfTownFee: number;
  totalKnown: number;
  hasQuote: boolean;
  quoteCount: number;
  quoteItems: string[];
}

export interface PricingSnapshot extends PricingSettings {
  capturedAt: string;
}

export interface OrderEventPayload {
  from?: string;
  to?: string;
  finalTotal?: number | null;
  agreedAt?: string | null;
  note?: string;
  code?: string;
  amount?: number;
  [key: string]: unknown;
}

export const appConfig = pgTable("app_config", {
  id: text("id").primaryKey(),
  company: jsonb("company").$type<CompanySettings>().notNull(),
  pricing: jsonb("pricing").$type<PricingSettings>().notNull(),
  game: jsonb("game").$type<GameSettings>().notNull(),
  character: jsonb("character").$type<CharacterSettings>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminUsers = pgTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("admin_users_email_idx").on(table.email)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("admin_sessions_token_idx").on(table.tokenHash),
    index("admin_sessions_user_idx").on(table.userId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNo: text("order_no").notNull(),
    publicToken: text("public_token").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("new"),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    deliveryMethod: text("delivery_method").notNull(),
    address: text("address"),
    outOfTown: boolean("out_of_town").notNull().default(false),
    preferredDate: date("preferred_date"),
    preferredTime: text("preferred_time"),
    comment: text("comment"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    items: jsonb("items").$type<PricedLine[]>().notNull(),
    pricingSnapshot: jsonb("pricing_snapshot").$type<PricingSnapshot>().notNull(),
    totals: jsonb("totals").$type<StoredTotals>().notNull(),
    knownSubtotal: integer("known_subtotal").notNull(),
    totalKnown: integer("total_known").notNull(),
    hasQuote: boolean("has_quote").notNull().default(false),
    finalTotal: integer("final_total"),
    agreedAt: timestamp("agreed_at", { withTimezone: true }),
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_no_idx").on(table.orderNo),
    uniqueIndex("orders_token_idx").on(table.publicToken),
    uniqueIndex("orders_idempotency_idx").on(table.idempotencyKey),
    index("orders_status_idx").on(table.status),
    index("orders_created_idx").on(table.createdAt),
  ],
);

export const orderPhotos = pgTable(
  "order_photos",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    mime: text("mime").notNull().default("image/webp"),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: bytea("bytes").notNull(),
    thumb: bytea("thumb").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_photos_order_idx").on(table.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<OrderEventPayload>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_events_order_idx").on(table.orderId)],
);

export const bonusCodes = pgTable(
  "bonus_codes",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    amount: integer("amount").notNull(),
    minOrder: integer("min_order").notNull(),
    status: text("status").notNull().default("issued"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("bonus_codes_order_idx").on(table.orderId),
    uniqueIndex("bonus_codes_code_idx").on(table.code),
  ],
);

export type OrderRow = typeof orders.$inferSelect;
export type OrderPhotoRow = typeof orderPhotos.$inferSelect;
export type OrderEventRow = typeof orderEvents.$inferSelect;
export type BonusCodeRow = typeof bonusCodes.$inferSelect;
export type AdminUserRow = typeof adminUsers.$inferSelect;
export type AppConfigRow = typeof appConfig.$inferSelect;
