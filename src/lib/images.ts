import "server-only";
import sharp from "sharp";

export const MAX_PHOTOS = 3;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 1600;

export interface ProcessedPhoto {
  bytes: Buffer;
  thumb: Buffer;
  mime: "image/webp";
  width: number;
  height: number;
}

export type PhotoResult =
  | { ok: true; photos: ProcessedPhoto[] }
  | { ok: false; error: string; index?: number };

export async function processPhotos(files: File[]): Promise<PhotoResult> {
  if (files.length > MAX_PHOTOS) {
    return { ok: false, error: `Можно приложить не больше ${MAX_PHOTOS} фотографий.` };
  }

  const photos: ProcessedPhoto[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    if (!file || file.size === 0) {
      return { ok: false, error: "Пустой файл. Выберите другое фото.", index };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return {
        ok: false,
        error: "Фото больше 8 МБ. Выберите файл поменьше или сожмите его.",
        index,
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectFormat(buffer);
    if (!detected) {
      return {
        ok: false,
        error: "Поддерживаются только JPEG, PNG и WebP. Проверьте формат файла.",
        index,
      };
    }

    try {
      const pipeline = sharp(buffer, { failOn: "error" }).rotate();
      const metadata = await pipeline.metadata();
      if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
        return {
          ok: false,
          error: "Файл не похож на JPEG, PNG или WebP.",
          index,
        };
      }
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (!width || !height) {
        return { ok: false, error: "Не удалось прочитать размеры фото.", index };
      }

      const bytes = await sharp(buffer, { failOn: "error" })
        .rotate()
        .resize({
          width: MAX_IMAGE_SIDE,
          height: MAX_IMAGE_SIDE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });

      const thumb = await sharp(buffer, { failOn: "error" })
        .rotate()
        .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 72, effort: 4 })
        .toBuffer({ resolveWithObject: true });

      photos.push({
        bytes: bytes.data,
        thumb: thumb.data,
        mime: "image/webp",
        width: bytes.info.width,
        height: bytes.info.height,
      });
    } catch {
      return {
        ok: false,
        error: "Не удалось обработать фото. Попробуйте другой файл.",
        index,
      };
    }
  }

  return { ok: true, photos };
}

function detectFormat(buffer: Buffer): "jpeg" | "png" | "webp" | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}
