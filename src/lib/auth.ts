import "server-only";
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { adminSessions, adminUsers } from "@/lib/db/schema";

export const SESSION_COOKIE = "tb_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
  sessionId: string;
  tokenHash: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionCookieOptions() {
  const secure =
    process.env.COOKIE_SECURE === "true" || (process.env.APP_URL ?? "").startsWith("https://");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export async function verifyCredentials(email: string, password: string) {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, normalized))
    .limit(1);
  const user = rows[0];
  if (!user) {
    // Сравнение с фиктивным хешем выравнивает время ответа для несуществующего e-mail.
    await compare(
      password,
      "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5S9n1W8x8XQ0h2M2LhZ0m1pW5v6v6v6",
    ).catch(() => false);
    return null;
  }
  const valid = await compare(password, user.passwordHash);
  return valid ? user : null;
}

export async function createAdminSession(
  userId: string,
  userAgent: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(adminSessions).values({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(token),
    userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const db = await getDb();
  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      sessionId: adminSessions.id,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, tokenHash),
        gt(adminSessions.expiresAt, new Date()),
        isNull(adminSessions.revokedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ...row, tokenHash };
}

export async function requireAdminPage(): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function requireAdminApi(): Promise<AdminIdentity | null> {
  return getCurrentAdmin();
}

export async function listActiveSessions(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: adminSessions.id,
      userAgent: adminSessions.userAgent,
      createdAt: adminSessions.createdAt,
      expiresAt: adminSessions.expiresAt,
    })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.userId, userId),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(adminSessions.createdAt));
}

export async function revokeCurrentSession(tokenHash: string): Promise<void> {
  const db = await getDb();
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.tokenHash, tokenHash));
}

export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<void> {
  const db = await getDb();
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(
      exceptSessionId
        ? and(eq(adminSessions.userId, userId), ne(adminSessions.id, exceptSessionId))
        : eq(adminSessions.userId, userId),
    );
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (nextPassword.length < 10) {
    return { ok: false, error: "Новый пароль должен быть не короче 10 символов." };
  }
  if (nextPassword === currentPassword) {
    return { ok: false, error: "Новый пароль должен отличаться от текущего." };
  }
  const db = await getDb();
  const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, userId)).limit(1);
  const user = rows[0];
  if (!user) return { ok: false, error: "Пользователь не найден." };
  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Текущий пароль неверный." };
  const passwordHash = await hash(nextPassword, 12);
  await db
    .update(adminUsers)
    .set({ passwordHash, passwordChangedAt: new Date() })
    .where(eq(adminUsers.id, userId));
  await revokeAllSessions(userId);
  return { ok: true };
}
