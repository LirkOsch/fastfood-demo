import "server-only";
import { eq } from "drizzle-orm";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import * as schema from "./schema";
import { SCHEMA_STATEMENTS } from "./schema-sql";
import {
  DEFAULT_CHARACTER,
  DEFAULT_COMPANY,
  DEFAULT_GAME,
  mergeSettings,
  sanitizeCharacter,
  sanitizeCompany,
  sanitizeGame,
  type AppSettings,
  type CharacterSettings,
  type CompanySettings,
  type GameSettings,
} from "@/lib/settings";
import {
  DEFAULT_PRICING,
  sanitizePricing,
  type PricingSettings,
} from "@/lib/pricing";

export type Db = PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __teplyboxDb?: Promise<Db>;
  __teplyboxDbKind?: "pglite" | "postgres";
};

export function getDb(): Promise<Db> {
  if (!globalForDb.__teplyboxDb) {
    globalForDb.__teplyboxDb = initDb().catch((error) => {
      globalForDb.__teplyboxDb = undefined;
      throw error;
    });
  }
  return globalForDb.__teplyboxDb;
}

async function initDb(): Promise<Db> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const { default: postgres } = await import("postgres");
    const client = postgres(databaseUrl, {
      max: 6,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
    });
    for (const statement of SCHEMA_STATEMENTS) {
      await client.unsafe(statement);
    }
    const db = drizzlePostgres(client, { schema }) as unknown as Db;
    globalForDb.__teplyboxDbKind = "postgres";
    await seed(db);
    return db;
  }

  const directory = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.PGLITE_DIR || path.join("data", "pglite"),
  );
  await mkdir(directory, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(directory);
  await client.waitReady;
  for (const statement of SCHEMA_STATEMENTS) {
    await client.exec(statement);
  }
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  globalForDb.__teplyboxDbKind = "pglite";
  await seed(db);
  return db;
}

async function seed(db: Db): Promise<void> {
  const configRows = await db.select().from(schema.appConfig).limit(1);
  if (configRows.length === 0) {
    await db.insert(schema.appConfig).values({
      id: "main",
      company: DEFAULT_COMPANY,
      pricing: DEFAULT_PRICING,
      game: DEFAULT_GAME,
      character: DEFAULT_CHARACTER,
      updatedAt: new Date(),
    });
  }

  const users = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).limit(1);
  if (users.length === 0) {
    const email = (process.env.OWNER_EMAIL || "owner@teplybox.example").toLowerCase();
    let password = process.env.OWNER_PASSWORD;
    if (!password) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "OWNER_PASSWORD не задан. Укажите OWNER_EMAIL и OWNER_PASSWORD в окружении для первого запуска.",
        );
      }
      password = "teplybox-demo-2026";
    }
    const passwordHash = await hash(password, 12);
    await db.insert(schema.adminUsers).values({
      id: randomUUID(),
      email,
      name: process.env.OWNER_NAME || "Владелец",
      passwordHash,
      passwordChangedAt: new Date(),
    });
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.select().from(schema.appConfig).limit(1);
  const row = rows[0];
  if (!row) return mergeSettings(null, null, null, null);
  return mergeSettings(row.company, row.pricing, row.game, row.character);
}

export async function getStoredConfig() {
  const db = await getDb();
  const rows = await db.select().from(schema.appConfig).limit(1);
  return rows[0] ?? null;
}

export async function saveCompany(company: CompanySettings): Promise<void> {
  const db = await getDb();
  const value = sanitizeCompany(company);
  await db
    .update(schema.appConfig)
    .set({ company: value, updatedAt: new Date() })
    .where(eq(schema.appConfig.id, "main"));
}

export async function savePricing(pricing: PricingSettings): Promise<void> {
  const db = await getDb();
  const value = sanitizePricing(pricing);
  value.version = Math.max(value.version + 1, Date.now());
  await db
    .update(schema.appConfig)
    .set({ pricing: value, updatedAt: new Date() })
    .where(eq(schema.appConfig.id, "main"));
}

export async function saveGame(game: GameSettings): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.appConfig)
    .set({ game: sanitizeGame(game), updatedAt: new Date() })
    .where(eq(schema.appConfig.id, "main"));
}

export async function saveCharacter(character: CharacterSettings): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.appConfig)
    .set({ character: sanitizeCharacter(character), updatedAt: new Date() })
    .where(eq(schema.appConfig.id, "main"));
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidates = [error, (error as { cause?: unknown }).cause];
  return candidates.some(
    (candidate) =>
      Boolean(candidate) &&
      typeof candidate === "object" &&
      (candidate as { code?: string }).code === "23505",
  );
}
