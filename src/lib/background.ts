import { after } from "next/server";

/**
 * Выполняет задачу после отправки ответа клиенту.
 *
 * На Vercel функция засыпает сразу после ответа, поэтому «выстрелил и забыл»
 * без `after` может не доехать. Вне запроса (например, в тестах) `after`
 * недоступен — тогда задача просто выполняется в фоне.
 */
export function scheduleBackground(task: Promise<unknown>): void {
  const settled = task.then(
    () => undefined,
    () => undefined,
  );
  try {
    after(settled);
  } catch {
    void settled;
  }
}
