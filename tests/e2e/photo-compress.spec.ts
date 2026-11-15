import { expect, test, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { CLIENT_MAX_BYTES } from "../../src/lib/client/photos";

const WIDTH = 3000;
const HEIGHT = 2250;
const VERCEL_LIMIT = 4.5 * 1024 * 1024;

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

    expect(compressedSize).toBeLessThanOrEqual(CLIENT_MAX_BYTES);
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

test("три обычных фото укладываются в общий лимит тела запроса", async ({ page }) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tb-three-photos-"));
  const files: string[] = [];
  try {
    for (let index = 1; index <= 3; index += 1) {
      const file = path.join(directory, `photo-${index}.jpg`);
      const noise = randomBytes(1800 * 1350 * 3);
      await sharp(noise, { raw: { width: 1800, height: 1350, channels: 3 } })
        .jpeg({ quality: 85 })
        .toFile(file);
      // Каждый файл меньше старого порога 4 МБ — раньше такие уходили без сжатия.
      expect((await stat(file)).size).toBeLessThan(4 * 1024 * 1024);
      files.push(file);
    }

    await addBurger(page);
    await page.getByTestId("cart-button").click();
    await page.getByTestId("go-checkout").click();
    await expect(page).toHaveURL(/\/checkout$/);

    await page.getByTestId("photo-input").setInputFiles(files);
    await expect(page.locator(".photo-thumb")).toHaveCount(3);

    // persistPhotos сохраняет уже сжатые файлы в IndexedDB — читаем их размеры
    // оттуда, чтобы проверить именно то, что уйдёт в запросе.
    const readSizes = () =>
      page.evaluate(
        () =>
          new Promise<Array<{ name: string; size: number }>>((resolve, reject) => {
            const open = indexedDB.open("keyval-store");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const get = db
                .transaction("keyval", "readonly")
                .objectStore("keyval")
                .get("tb-draft-photos-v1");
              get.onerror = () => reject(get.error);
              get.onsuccess = () => {
                const stored = Array.isArray(get.result) ? get.result : [];
                resolve(
                  stored.map((file: File) => ({ name: file.name, size: file.size })),
                );
              };
            };
          }),
      );

    await expect.poll(async () => (await readSizes()).length).toBe(3);
    const stored = await readSizes();
    for (const photo of stored) {
      expect(photo.size).toBeLessThanOrEqual(CLIENT_MAX_BYTES);
    }
    expect(stored.reduce((sum, photo) => sum + photo.size, 0)).toBeLessThan(
      VERCEL_LIMIT - 10_000,
    );

    await page.getByTestId("customer-name").fill("Тест Три Фото");
    await page.getByTestId("phone").fill("+7 912 000-00-09");
    await page.getByTestId("delivery-pickup").click();
    await page.getByTestId("consent").check();
    await page.getByTestId("submit-order").click();
    await expect(page).toHaveURL(/\/order\/[A-Za-z0-9_-]+/, { timeout: 30_000 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
