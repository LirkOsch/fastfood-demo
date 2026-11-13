export interface OriginCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Проверяем Origin/Referer у всех изменяющих запросов.
 * Это дополнение к SameSite=Lax cookie, а не замена авторизации.
 */
export function checkRequestOrigin(request: Request): OriginCheck {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const candidate = origin || referer;
  if (!candidate) {
    return {
      ok: false,
      reason: "Запрос без Origin/Referer отклонён.",
    };
  }

  let candidateHost: string;
  try {
    candidateHost = new URL(candidate).host.toLowerCase();
  } catch {
    return { ok: false, reason: "Некорректный Origin." };
  }

  const allowed = new Set<string>();
  const host = request.headers.get("host");
  if (host) allowed.add(host.toLowerCase());
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) allowed.add(forwardedHost.split(",")[0]!.trim().toLowerCase());
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).host.toLowerCase());
    } catch {
      // ignore malformed APP_URL
    }
  }
  if (process.env.NODE_ENV !== "production") {
    allowed.add("localhost:3000");
    allowed.add("127.0.0.1:3000");
  }

  if (allowed.has(candidateHost)) return { ok: true };
  return {
    ok: false,
    reason: `Origin ${candidateHost} не совпадает с хостом приложения.`,
  };
}
