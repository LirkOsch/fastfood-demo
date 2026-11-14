/**
 * Клиентское сжатие фото перед отправкой.
 *
 * На Vercel размер тела запроса ограничен 4.5 МБ, поэтому три фотографии
 * нельзя отправлять как есть. Здесь файл ужимается в браузере, а сервер
 * всё равно повторно проверяет формат и сжимает (см. src/lib/images.ts).
 */

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Жёсткий предел одного файла в форме заказа (лимит Vercel — 4.5 МБ). */
export const CLIENT_MAX_BYTES = 4 * 1024 * 1024;

const MAX_SIDE = 1600;
const START_QUALITY = 0.82;
const MIN_QUALITY = 0.5;
const MAX_ATTEMPTS = 6;

function pickName(file: File, mime: "image/webp"): string {
  return mime === "image/webp" ? file.name.replace(/\.(jpe?g|png)$/i, "") + ".webp" : file.name;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Дальше пробуем обычный <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Возвращает файл, гарантированно не тяжелее `maxBytes` и в допустимом
 * формате. Если исходник уже подходит — не трогаем его (без потери качества).
 */
export async function compressPhoto(file: File, maxBytes = CLIENT_MAX_BYTES): Promise<File> {
  if (file.size === 0) return file;
  if (file.size <= maxBytes && ALLOWED_TYPES.has(file.type)) return file;

  const source = await decode(file);
  try {
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    let targetWidth = Math.max(1, Math.round(width * scale));
    let targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return file;

    let quality = START_QUALITY;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      context.clearRect(0, 0, targetWidth, targetHeight);
      context.drawImage(source, 0, 0, targetWidth, targetHeight);

      const blob = await toBlob(canvas, "image/webp", quality);
      if (blob && blob.size <= maxBytes) {
        return new File([blob], pickName(file, "image/webp"), { type: "image/webp" });
      }

      // Качество вниз, а если и так минимальное — уменьшаем размер.
      if (quality > MIN_QUALITY) {
        quality = Math.max(MIN_QUALITY, quality - 0.1);
      } else {
        targetWidth = Math.max(1, Math.round(targetWidth * 0.75));
        targetHeight = Math.max(1, Math.round(targetHeight * 0.75));
        quality = MIN_QUALITY;
      }
    }

    // Не смогли ужать — возвращаем оригинал, сервер ответит понятной ошибкой.
    return file;
  } finally {
    if ("close" in source) source.close();
  }
}
