"use client";

const DRAFT_KEY = "tb-checkout-draft-v1";
const PHOTOS_KEY = "tb-draft-photos-v1";
const IDEMPOTENCY_KEY = "tb-idempotency-key-v1";

export interface CheckoutDraft {
  version: 1;
  customerName: string;
  phone: string;
  deliveryMethod: "delivery" | "pickup";
  address: string;
  outOfTown: boolean;
  preferredDate: string;
  preferredTime: string;
  comment: string;
  consent: boolean;
  idempotencyKey: string;
  updatedAt: string;
}

export function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
}

export function emptyDraft(idempotencyKey: string): CheckoutDraft {
  return {
    version: 1,
    customerName: "",
    phone: "",
    deliveryMethod: "delivery",
    address: "",
    outOfTown: false,
    preferredDate: "",
    preferredTime: "",
    comment: "",
    consent: false,
    idempotencyKey,
    updatedAt: "",
  };
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export function loadDraft(): CheckoutDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const first = JSON.parse(raw) as Record<string, unknown>;
    if (!first || first.version !== 1) return null;

    let idempotencyKey = text(first.idempotencyKey, 80);
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey)) {
      idempotencyKey =
        window.localStorage.getItem(IDEMPOTENCY_KEY) ?? newIdempotencyKey();
    }

    return {
      version: 1,
      customerName: text(first.customerName, 80),
      phone: text(first.phone, 25),
      deliveryMethod: first.deliveryMethod === "pickup" ? "pickup" : "delivery",
      address: text(first.address, 220),
      outOfTown: first.outOfTown === true,
      preferredDate: text(first.preferredDate, 10),
      preferredTime: text(first.preferredTime, 5),
      comment: text(first.comment, 1000),
      consent: first.consent === true,
      idempotencyKey,
      updatedAt: text(first.updatedAt, 40),
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: CheckoutDraft): boolean {
  try {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
    window.localStorage.setItem(IDEMPOTENCY_KEY, draft.idempotencyKey);
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(IDEMPOTENCY_KEY);
  } catch {
    // ignore
  }
}

export async function loadDraftPhotos(): Promise<File[]> {
  try {
    const { get } = await import("idb-keyval");
    const value = await get<unknown>(PHOTOS_KEY);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is File =>
        entry instanceof File && entry.type.startsWith("image/"),
    ).slice(0, 3);
  } catch {
    return [];
  }
}

export async function saveDraftPhotos(files: File[]): Promise<boolean> {
  try {
    const { set } = await import("idb-keyval");
    await set(PHOTOS_KEY, files);
    return true;
  } catch {
    return false;
  }
}

export async function clearDraftPhotos(): Promise<void> {
  try {
    const { del } = await import("idb-keyval");
    await del(PHOTOS_KEY);
  } catch {
    // ignore
  }
}
