import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// База тянет "server-only" — в тестовом окружении подменяем пустышкой.
vi.mock("server-only", () => ({}));

type Db = Awaited<ReturnType<typeof import("@/lib/db").getDb>>;

let directory = "";
let db: Db;
let purgeOldOrders: typeof import("@/lib/retention").purgeOldOrders;

beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "tb-retention-"));
  process.env.DATABASE_URL = "";
  process.env.PGLITE_DIR = directory;
  process.env.OWNER_PASSWORD = "test-password-12345";

  const dbModule = await import("@/lib/db");
  const retention = await import("@/lib/retention");
  db = await dbModule.getDb();
  purgeOldOrders = retention.purgeOldOrders;
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

function orderInput(key: string) {
  return {
    idempotencyKey: key,
    items: [
      { key: "b-boxy:standard:", itemId: "b-boxy", variant: "standard", qty: 1, options: [] },
    ],
    customerName: "Тест Хранения",
    phone: "+7 912 000-00-05",
    deliveryMethod: "pickup" as const,
    address: "",
    outOfTown: false,
    preferredDate: "",
    preferredTime: "",
    comment: "",
    consent: true,
  };
}

describe("автоочистка старых заказов", () => {
  it("удаляет только заказы старше срока и убирает их фото", async () => {
    const { createOrder } = await import("@/lib/orders");
    const schema = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const oldOrder = await createOrder(orderInput(`retention-old-${Date.now()}`), [
      {
        mime: "image/webp",
        width: 10,
        height: 10,
        bytes: new Uint8Array([1, 2, 3, 4]) as unknown as Buffer,
        thumb: new Uint8Array([1, 2, 3]) as unknown as Buffer,
      },
    ]);
    const freshOrder = await createOrder(orderInput(`retention-fresh-${Date.now()}`), []);
    expect(oldOrder.ok).toBe(true);
    expect(freshOrder.ok).toBe(true);
    if (!oldOrder.ok || !freshOrder.ok) return;

    const now = new Date();
    // Отодвигаем «старый» заказ на 200 дней назад.
    await db
      .update(schema.orders)
      .set({ createdAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000) })
      .where(eq(schema.orders.orderNo, oldOrder.orderNo));

    const deleted = await purgeOldOrders(90, now);
    expect(deleted).toBe(1);

    const left = await db.select({ orderNo: schema.orders.orderNo }).from(schema.orders);
    expect(left.map((row) => row.orderNo)).toEqual([freshOrder.orderNo]);

    const photos = await db.select({ id: schema.orderPhotos.id }).from(schema.orderPhotos);
    expect(photos).toHaveLength(0);

    const events = await db.select({ id: schema.orderEvents.id }).from(schema.orderEvents);
    expect(events.every(Boolean)).toBe(true);
  });

  it("ничего не удаляет, когда все заказы свежие", async () => {
    expect(await purgeOldOrders(90)).toBe(0);
  });
});
