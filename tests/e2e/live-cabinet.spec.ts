import { expect, test } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OWNER = {
  email: process.env.OWNER_EMAIL || "owner@teplybox.example",
  password: process.env.OWNER_PASSWORD || "teplybox-demo-2026",
};

async function login(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByTestId("login-email").fill(OWNER.email);
  await page.getByTestId("login-password").fill(OWNER.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("кабинет сам замечает новый заказ без перезагрузки", async ({ page, request }) => {
  await login(page);
  await page.goto("/admin/orders");
  await expect(page.getByRole("heading", { name: /Заказы/ })).toBeVisible();

  // Первый опрос запоминает текущее состояние — даём ему пройти.
  await page.waitForTimeout(3_000);

  const created = await request.post("/api/orders", {
    headers: { Origin: BASE, Accept: "application/json" },
    multipart: {
      payload: JSON.stringify({
        idempotencyKey: `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        items: [
          { key: "b-boxy:standard:", itemId: "b-boxy", variant: "standard", qty: 1, options: [] },
        ],
        customerName: "Живой Кабинет",
        phone: "+7 912 000-00-03",
        deliveryMethod: "pickup",
        address: "",
        outOfTown: false,
        preferredDate: "",
        preferredTime: "",
        comment: "",
        consent: true,
      }),
    },
  });
  expect(created.status()).toBe(201);
  const data = (await created.json()) as { orderNo: string };
  expect(data.orderNo).toMatch(/^TB-\d{6}-[A-Z0-9]{4}$/);

  // Опрос идёт раз в 15 секунд, поэтому ждём с запасом.
  await expect(page.getByText(`Новый заказ ${data.orderNo}`)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByLabel(/Новых заказов/)).toBeVisible();
});

test("опрос кабинета и автоочистка закрыты без доступа", async ({ request }) => {
  const pulse = await request.get("/api/admin/orders/pulse");
  expect(pulse.status()).toBe(401);

  const retention = await request.get("/api/cron/retention");
  expect([401, 503]).toContain(retention.status());
});

test("кнопка проверки уведомлений отправляет сообщение или объясняет, что канал не настроен", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Уведомления", { exact: true })).toBeVisible();
  const testButton = page.getByRole("button", {
    name: /Проверить настройку|Отправить проверочное сообщение/,
  });
  await testButton.click();
  await expect(page.getByText(/TELEGRAM_BOT_TOKEN|Сообщение отправлено/)).toBeVisible({
    timeout: 15_000,
  });
});
