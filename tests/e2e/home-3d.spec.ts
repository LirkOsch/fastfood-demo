import { expect, test } from "@playwright/test";

test("главная с 3D-сценой загружается без ошибок", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/", { waitUntil: "load" });

  // Проверяем именно живую сцену, а не облегчённую версию с ?static=1:
  // так регрессии CSP/WebGL и загрузки моделей не останутся незамеченными.
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(3_000);

  expect(errors).toEqual([]);
});
