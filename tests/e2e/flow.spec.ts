import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const PHOTO = path.join(__dirname, "..", "fixtures", "sample-photo.png");
const TEXT_FILE = path.join(__dirname, "..", "fixtures", "not-an-image.txt");

const OWNER = {
  email: process.env.OWNER_EMAIL || "owner@teplybox.example",
  password: process.env.OWNER_PASSWORD || "teplybox-demo-2026",
};

function tomorrow(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

async function addBurger(page: Page, options: { large?: boolean } = {}) {
  await page.goto("/?static=1#menu");
  await page.getByTestId("menu-tab-burgers").click();
  await page.getByTestId("item-b-boxy").click();
  if (options.large) {
    await page.getByRole("group", { name: "Размер порции" }).getByRole("button", { name: "Большой" }).click();
  }
  await page.getByTestId("option-double").click();
  await page.getByTestId("option-sauce").click();
  await page.getByTestId("add-to-cart").click();
}

async function addCustom(page: Page, description: string) {
  await page.getByTestId("menu-tab-custom").click();
  await page.getByTestId("item-custom").click();
  await page.getByTestId("custom-description").fill(description);
  await page.getByTestId("add-to-cart").click();
}

test.describe.configure({ mode: "serial" });

test("клиент оформляет смешанный заказ, владелец подтверждает, клиент видит изменения и бонус", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await addBurger(page, { large: true });
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await addCustom(page, "Большой бокс без лука, с курицей и острым соусом, разрезать пополам");

  await expect(page.getByTestId("cart-count")).toHaveText("2");
  await page.getByTestId("cart-button").click();
  await expect(page.getByTestId("cart-line")).toHaveCount(2);
  await expect(page.getByTestId("cart-total")).toContainText("673");
  await expect(page.getByText("Цена по запросу").first()).toBeVisible();
  await page.getByTestId("go-checkout").click();

  await expect(page).toHaveURL(/\/checkout$/);
  await page.getByTestId("customer-name").fill("Тест Боксик");
  await page.getByTestId("phone").fill("+7 912 000-00-01");
  await page.getByTestId("delivery-pickup").click();
  await page.getByTestId("preferred-date").fill(tomorrow());
  await page.getByTestId("preferred-time").fill("18:30");
  await page.getByTestId("comment").fill("Тестовый заказ: без лука, соус отдельно.");
  await page.getByTestId("consent").check();
  await page.getByTestId("photo-input").setInputFiles(PHOTO);

  await expect(page.getByText("sample-photo.png")).toBeVisible();
  const checkoutTotal = await page.getByTestId("checkout-total").innerText();
  expect(checkoutTotal).toContain("673");

  await page.getByTestId("submit-order").click();
  await expect(page).toHaveURL(/\/order\/[A-Za-z0-9_-]+/, { timeout: 30_000 });

  const orderUrl = page.url();
  const orderText = await page.locator("main").innerText();
  const orderNo = orderText.match(/TB-\d{6}-[A-Z0-9]{4}/)?.[0];
  expect(orderNo).toBeTruthy();
  const token = new URL(orderUrl).pathname.split("/").pop();
  expect(token).toBeTruthy();

  await expect(page.getByTestId("order-status")).toContainText("Новый");
  await expect(page.getByTestId("order-total")).toContainText("673");
  await expect(page.getByText("По запросу").first()).toBeVisible();
  await expect(page.getByRole("img", { name: "Фото, приложенное к заказу" })).toHaveCount(1);
  await expect(page.getByTestId("open-game")).toHaveCount(0);
  await expect(page.getByText(/Игра откроется/)).toBeVisible();

  const photoResponse = await request.get(
    `/api/orders/${token}/photos/${await page
      .getByRole("img", { name: "Фото, приложенное к заказу" })
      .getAttribute("src")
      .then((src) => src?.split("/").pop())}`,
  );
  expect(photoResponse.status()).toBe(200);
  expect(photoResponse.headers()["content-type"]).toContain("image/webp");

  // Владелец входит в кабинет.
  await page.goto("/admin/login");
  await page.getByTestId("login-email").fill(OWNER.email);
  await page.getByTestId("login-password").fill(OWNER.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto(`/admin/orders?q=${encodeURIComponent(orderNo!)}`);
  await page.getByRole("link", { name: orderNo! }).click();
  await expect(page.getByTestId("admin-order-form")).toBeVisible();
  await expect(page.getByTestId("final-total")).toBeVisible();

  await page.getByRole("button", { name: /Подтверждён/ }).click();
  await page.getByTestId("final-total").fill("1450");
  await page.getByTestId("agreed-at").fill(`${tomorrow()}T19:00`);
  await page.getByTestId("admin-note").fill("Внутренняя заметка: клиент просил без лука.");
  await page.getByTestId("save-order").click();
  await expect(page.getByText(/Сохранено/)).toBeVisible();

  await page.goto(orderUrl);
  await expect(page.getByTestId("order-status")).toContainText("Подтверждён");
  // formatRub группирует разряды пробелом: «1 450 ₽».
  await expect(page.getByTestId("order-total")).toContainText(/1\s*450/);
  await expect(page.getByText("19:00")).toBeVisible();
  await expect(page.getByText("Внутренняя заметка")).toHaveCount(0);

  // Владелец завершает заказ.
  await page.goto(`/admin/orders?q=${encodeURIComponent(orderNo!)}`);
  await page.getByRole("link", { name: orderNo! }).click();
  await page.getByRole("button", { name: /Выполнен/ }).click();
  await page.getByTestId("save-order").click();
  await expect(page.getByText(/Сохранено/)).toBeVisible();

  await page.goto(orderUrl);
  await expect(page.getByTestId("order-status")).toContainText("Выполнен");
  await expect(page.getByTestId("open-game")).toBeVisible();
  await page.getByTestId("open-game").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Чистый поднос").first()).toBeVisible();
  const gameClose = page.getByRole("button", { name: "Закрыть игру" });
  if (await gameClose.isEnabled().catch(() => false)) await gameClose.click();

  // Начисляем бонус через серверный endpoint (сама 3D-игра проверяется вручную).
  const gameResponse = await request.post(`/api/orders/${token}/game`, {
    headers: { Origin: BASE, Accept: "application/json" },
  });
  expect(gameResponse.status()).toBe(200);
  const gameData = (await gameResponse.json()) as { ok: boolean; mode: string; bonus?: { code: string } };
  expect(gameData.ok).toBe(true);
  expect(gameData.mode).toBe("bonus");
  expect(gameData.bonus?.code).toMatch(/^BOX-[A-Z2-9]{6}$/);

  await page.goto(orderUrl);
  await expect(page.getByTestId("bonus-code")).toBeVisible();
  await expect(page.getByTestId("bonus-code")).toContainText("BOX-");

  await page.goto(`/admin/orders?q=${encodeURIComponent(orderNo!)}`);
  await page.getByRole("link", { name: orderNo! }).click();
  await page.getByTestId("redeem-bonus").click();
  await expect(page.getByText("Бонус отмечен использованным.")).toBeVisible();
  await expect(page.getByText("использован", { exact: true })).toBeVisible();

  await page.goto(orderUrl);
  await expect(page.getByText("Бонус уже использован.")).toBeVisible();

  expect(errors).toEqual([]);
});

test("корзина переживает перезагрузку, одинаковые строки сливаются, разные — разделяются, удаление отменяется", async ({
  page,
}) => {
  await addBurger(page);
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("2");
  await page.getByTestId("cart-button").click();
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await expect(page.getByTestId("cart-line").getByLabel(/Количество:/)).toHaveText("2");
  await page.getByRole("button", { name: "Закрыть корзину" }).click();

  await page.getByRole("group", { name: "Размер порции" }).getByRole("button", { name: "Большой" }).click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText("3");
  await page.getByTestId("cart-button").click();
  await expect(page.getByTestId("cart-line")).toHaveCount(2);

  await page.locator('[data-testid="cart-line"]').first().getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await expect(page.getByText("Вернуть")).toBeVisible();
  await page.getByText("Вернуть").click();
  await expect(page.getByTestId("cart-line")).toHaveCount(2);

  await page.reload();
  await page.getByTestId("cart-button").click();
  await expect(page.getByTestId("cart-line")).toHaveCount(2);
  await expect(page.getByTestId("cart-count")).toHaveText("3");
});

test("черновик оформления и фото восстанавливаются после перезагрузки", async ({ page }) => {
  await addBurger(page);
  await page.goto("/checkout");
  await page.getByTestId("customer-name").fill("Черновик Тест");
  await page.getByTestId("phone").fill("+7 912 555-44-33");
  await page.getByTestId("comment").fill("Проверка восстановления черновика");
  await page.getByTestId("consent").check();
  await page.getByTestId("photo-input").setInputFiles(PHOTO);
  await expect(page.getByText("sample-photo.png")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Черновик восстановлен")).toBeVisible();
  await expect(page.getByTestId("customer-name")).toHaveValue("Черновик Тест");
  await expect(page.getByTestId("phone")).toHaveValue("+7 912 555-44-33");
  await expect(page.getByTestId("comment")).toHaveValue("Проверка восстановления черновика");
  await expect(page.getByText("sample-photo.png")).toBeVisible();

  await page.getByRole("button", { name: "Удалить фото sample-photo.png" }).click();
  await expect(page.getByText("sample-photo.png")).toHaveCount(0);
});

test("сервер проверяет настоящий формат фото, а не расширение", async ({ request }) => {
  const payload = {
    idempotencyKey: `e2e-bad-photo-${Date.now()}`,
    items: [{ key: "b-boxy|standard|", itemId: "b-boxy", variant: "standard", qty: 1, options: [] }],
    customerName: "Плохое фото",
    phone: "+7 912 111-22-33",
    deliveryMethod: "pickup",
    address: "",
    outOfTown: false,
    preferredDate: "",
    preferredTime: "",
    comment: "",
    consent: true,
  };
  const response = await request.post("/api/orders", {
    headers: { Origin: BASE, Accept: "application/json" },
    multipart: {
      payload: JSON.stringify(payload),
      photos: {
        name: "disguised.png",
        mimeType: "image/png",
        buffer: readFileSync(TEXT_FILE),
      },
    },
  });
  expect(response.status()).toBe(422);
  const data = (await response.json()) as { error: string };
  expect(data.error).toMatch(/JPEG, PNG и WebP/);
});

test("повторная отправка с тем же ключом идемпотентна и не создаёт второй заказ", async ({ request }) => {
  const key = `e2e-idem-${Date.now()}`;
  const payload = {
    idempotencyKey: key,
    items: [{ key: "b-chicken|standard|", itemId: "b-chicken", variant: "standard", qty: 1, options: [] }],
    customerName: "Идемпотент Тест",
    phone: "+7 912 222-33-44",
    deliveryMethod: "pickup",
    address: "",
    outOfTown: false,
    preferredDate: "",
    preferredTime: "",
    comment: "",
    consent: true,
  };
  const first = await request.post("/api/orders", {
    headers: { Origin: BASE, Accept: "application/json" },
    multipart: { payload: JSON.stringify(payload) },
  });
  expect(first.status()).toBe(201);
  const firstData = (await first.json()) as { token: string; orderNo: string; idempotent: boolean };
  expect(firstData.idempotent).toBe(false);

  const second = await request.post("/api/orders", {
    headers: { Origin: BASE, Accept: "application/json" },
    multipart: { payload: JSON.stringify(payload) },
  });
  expect(second.status()).toBe(200);
  const secondData = (await second.json()) as { token: string; orderNo: string; idempotent: boolean };
  expect(secondData.idempotent).toBe(true);
  expect(secondData.token).toBe(firstData.token);
  expect(secondData.orderNo).toBe(firstData.orderNo);
});

test("владелец удаляет заказ с фото, приватная ссылка после этого закрыта", async ({ page, request }) => {
  const payload = {
    idempotencyKey: `e2e-delete-${Date.now()}`,
    items: [{ key: "k-fries|standard|", itemId: "k-fries", variant: "standard", qty: 1, options: [] }],
    customerName: "Удаление Тест",
    phone: "+7 912 333-44-55",
    deliveryMethod: "pickup",
    address: "",
    outOfTown: false,
    preferredDate: "",
    preferredTime: "",
    comment: "",
    consent: true,
  };
  const created = await request.post("/api/orders", {
    headers: { Origin: BASE, Accept: "application/json" },
    multipart: {
      payload: JSON.stringify(payload),
      photos: { name: "photo.png", mimeType: "image/png", buffer: readFileSync(PHOTO) },
    },
  });
  expect(created.status()).toBe(201);
  const data = (await created.json()) as { token: string; orderNo: string };

  await page.goto("/admin/login");
  await page.getByTestId("login-email").fill(OWNER.email);
  await page.getByTestId("login-password").fill(OWNER.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto(`/admin/orders?q=${encodeURIComponent(data.orderNo)}`);
  await page.getByRole("link", { name: data.orderNo }).click();
  await page.getByRole("button", { name: "Удалить заказ" }).click();
  await page.getByTestId("delete-confirm").fill(data.orderNo);
  await page.getByRole("checkbox").check();
  await page.getByTestId("delete-order").click();
  await expect(page).toHaveURL(/\/admin\/orders$/);

  const client = await page.request.get(`/order/${data.token}`);
  expect(client.status()).toBe(404);
});

test("закрытые маршруты и PWA-манифест", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);

  const missing = await page.goto("/order/not-a-real-token-000000000000");
  expect(missing?.status()).toBe(404);

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const json = (await manifest.json()) as {
    name: string;
    display: string;
    icons: Array<{ sizes: string }>;
    start_url: string;
  };
  expect(json.name).toContain("Тёплый бокс");
  expect(json.display).toBe("standalone");
  expect(json.start_url).toBe("/");
  expect(json.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );

  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toContain("javascript");

  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Sitemap:");
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/privacy");
});

test("светлая и тёмная темы переключаются и сохраняются, мобильный вид без горизонтального скролла", async ({
  page,
}) => {
  await page.goto("/?static=1");
  const html = page.locator("html");
  const initial = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: /Включить (светлую|тёмную) тему/ }).click();
  const next = await html.getAttribute("data-theme");
  expect(next).not.toBe(initial);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", next!);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?static=1");
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  await expect(page.getByTestId("cart-button")).toBeVisible();
  // На мобильной ширине CTA «Оформить» в шапке скрыт намеренно — переход через корзину.
  await expect(page.locator(".header-order")).toBeHidden();
  await page.getByTestId("cart-button").click();
  // Корзина открывается прямо в шапке; к оформлению ведут ссылка внутри неё.
  await expect(page.getByTestId("cart-empty")).toBeVisible();

  await page.goto("/checkout");
  await expect(page.getByTestId("empty-cart")).toBeVisible();
  const checkoutOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(checkoutOverflow).toBeLessThanOrEqual(1);
});

