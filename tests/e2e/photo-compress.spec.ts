import { expect, test, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 3000;
const HEIGHT = 2250;
const CLIENT_LIMIT = 4 * 1024 * 1024;

async function addBurger(page: Page) {
  await page.goto("/?static=1#menu");
  await page.getByTestId("menu-tab-burgers").click();
  await page.getByTestId("item-b-boxy").click();
  await page.getByTestId("add-to-cart").click();
}

test("большое фото сжимается в браузере до лимита тела запроса", async ({ page }) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tb-large-photo-"));
  const file = path.join(directory, "big-photo.jpg");
  try {
    // Шум почти не сжимается — такой JPEG заведомо тяжелее лимита Vercel (4.5 МБ).
    const noise = randomBytes(WIDTH * HEIGHT * 3);
    await sharp(noise, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
      .jpeg({ quality: 100 })
      .toFile(file);
    const originalSize = (await stat(file)).size;
    expect(originalSize).toBeGreaterThan(4.5 * 1024 * 1024);

    await addBurger(page);
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.getByTestId("cart-button").click();
    await page.getByTestId("go-checkout").click();
    await expect(page).toHaveURL(/\/checkout$/);

    await page.getByTestId("photo-input").setInputFiles(file);
    await expect(page.getByText("big-photo.webp")).toBeVisible();

    // Превью показывает уже сжатый файл: проверяем его размер по-настоящему,
    // скачав blob-URL (запрос fetch блокирует CSP connect-src).
    const source = await page.locator(".photo-thumb img").first().getAttribute("src");
    expect(source).toBeTruthy();
    const downloadPromise = page.waitForEvent("download");
    const shownName = await page.locator(".photo-thumb__name").first().innerText();
    await page.evaluate(
      ({ url, name }) => {
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      },
      { url: source!, name: shownName },
    );
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(shownName);
    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    const compressedSize = (await stat(downloadedPath!)).size;

    expect(compressedSize).toBeLessThanOrEqual(CLIENT_LIMIT);
    expect(compressedSize).toBeLessThan(originalSize);
    // Исходник 3000 px по ширине — после сжатия остаётся не больше MAX_SIDE.
    const naturalWidth = await page
      .locator(".photo-thumb img")
      .first()
      .evaluate((image) => (image as HTMLImageElement).naturalWidth);
    expect(naturalWidth).toBeLessThanOrEqual(1600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
