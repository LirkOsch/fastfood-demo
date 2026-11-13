import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("помощник отвечает по живым ценам, понимает быстрые вопросы и кладёт блюдо в корзину", async ({
  page,
}) => {
  await page.goto("/");

  const launcher = page.getByTestId("assistant-launcher");
  await expect(launcher).toBeVisible();
  await launcher.click();

  const panel = page.getByTestId("assistant-panel");
  await expect(panel).toBeVisible();

  const input = page.getByTestId("assistant-input");
  const messages = page.getByTestId("assistant-messages");

  await input.fill("Сколько стоит доставка?");
  await page.getByTestId("assistant-send").click();
  await expect(messages).toContainText("149", { timeout: 20_000 });
  await expect(messages).toContainText("за город");

  await page.getByTestId("assistant-chip").filter({ hasText: "Самовывоз?" }).click();
  await expect(messages).toContainText("Забрать можно по адресу", { timeout: 20_000 });

  await input.fill("расскажи про боксик");
  await page.getByTestId("assistant-send").click();
  await expect(messages).toContainText("Боксик-бургер", { timeout: 20_000 });

  const add = page.getByTestId("assistant-add").last();
  await expect(add).toBeVisible();
  await add.click();

  await expect(page.getByTestId("cart-line").first()).toContainText("Боксик-бургер", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("assistant-add").last()).toContainText("Добавлено");
});

test("на мобильном панель не создаёт горизонтальный скролл, а на приватных страницах помощника нет", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByTestId("assistant-launcher").click();
  const panel = page.getByTestId("assistant-panel");
  await expect(panel).toBeVisible();

  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByTestId("assistant-close").click();
  await expect(panel).toHaveCount(0);

  for (const path of ["/checkout", "/admin/login"]) {
    await page.goto(path);
    await expect(page.getByTestId("assistant-launcher")).toHaveCount(0);
  }
});
