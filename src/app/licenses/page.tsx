import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/site/LegalShell";
import { getAppSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Лицензии и атрибуция",
  description:
    "Какие библиотеки, шрифты и 3D-ассеты использует демо-кафе «Тёплый бокс» и на каких условиях.",
  alternates: { canonical: "/licenses" },
};

export default async function LicensesPage() {
  const settings = await getAppSettings();
  return (
    <LegalShell
      company={settings.company}
      title="Лицензии и атрибуция"
      meta="Ниже перечислены компоненты, которые используются в проекте, и условия их распространения."
    >
      <section>
        <h2>Собственные материалы</h2>
        <p>
          Дизайн, тексты, SVG-иллюстрации, логотип и процедурные 3D-модели созданы для этого
          демонстрационного проекта. Сторонние фотографии и чужие 3D-модели не используются.
          Исходники генератора моделей лежат в <code>scripts/build-models.ts</code>, готовые
          GLB-файлы — в <code>public/models</code>.
        </p>
      </section>

      <section>
        <h2>Шрифты</h2>
        <ul>
          <li>
            <strong>Onest</strong> — SIL Open Font License 1.1, файлы{" "}
            <code>public/fonts/onest-*.woff2</code>.
          </li>
          <li>
            <strong>Unbounded</strong> — SIL Open Font License 1.1, файлы{" "}
            <code>public/fonts/unbounded-*.woff2</code>.
          </li>
        </ul>
        <p>
          Шрифты подключены локально через <code>@font-face</code>, без внешних CDN. Тексты
          лицензий можно получить у правообладателей и положить рядом со шрифтами при публикации.
        </p>
      </section>

      <section>
        <h2>Библиотеки</h2>
        <ul>
          <li><strong>Next.js</strong> — MIT;</li>
          <li><strong>React</strong> и <strong>React DOM</strong> — MIT;</li>
          <li><strong>Three.js</strong>, <strong>@react-three/fiber</strong>, <strong>@react-three/drei</strong> — MIT;</li>
          <li><strong>Drizzle ORM</strong> и <strong>drizzle-kit</strong> — Apache-2.0;</li>
          <li><strong>@electric-sql/pglite</strong> — Apache-2.0;</li>
          <li><strong>postgres.js</strong> — Unlicense;</li>
          <li><strong>Zod</strong> — MIT;</li>
          <li><strong>bcryptjs</strong> — MIT;</li>
          <li><strong>sharp</strong> — Apache-2.0;</li>
          <li><strong>date-fns</strong> и <strong>date-fns-tz</strong> — MIT;</li>
          <li><strong>motion</strong> — MIT;</li>
          <li><strong>gltf-transform</strong> — MIT.</li>
        </ul>
        <p>
          Полные тексты лицензий находятся в пакетах внутри <code>node_modules</code> и в
          репозиториях соответствующих проектов. При распространении сборки сохраните уведомления
          об авторских правах.
        </p>
      </section>

      <section>
        <h2>Данные и изображения</h2>
        <p>
          Список реальных заведений Удмуртии использовался только как ориентир для категорий меню.
          Контакты, названия и фирменный стиль реальных кафе в проекте не воспроизводятся.
          Изображения блюд — оригинальные SVG и процедурные 3D-модели, а не стоковые фотографии.
        </p>
        <p>
          <Link href="/privacy">Политика конфиденциальности</Link> ·{" "}
          <Link href="/terms">Условия заказа</Link>
        </p>
      </section>
    </LegalShell>
  );
}
