import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/site/LegalShell";
import { getAppSettings } from "@/lib/db";
import { formatPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Контакты",
  description:
    "Как связаться с демо-кафе «Тёплый бокс»: адрес, часы работы, телефон и почта. Контакты вымышлены.",
  alternates: { canonical: "/contacts" },
};

export default async function ContactsPage() {
  const settings = await getAppSettings();
  const { company } = settings;
  return (
    <LegalShell
      company={company}
      title="Контакты"
      meta="Демонстрационный проект: адрес, телефон и почта вымышлены и не ведут в реальное кафе."
    >
      <section className="legal-card">
        <h2 style={{ marginTop: 0 }}>{company.name}</h2>
        <p>{company.description}</p>
        <ul>
          <li>
            <strong>Адрес самовывоза:</strong> {company.address}
          </li>
          <li>
            <strong>Город и зона доставки:</strong> {company.city}, {company.deliveryArea}
          </li>
          <li>
            <strong>Часы работы:</strong> {company.workingHours}
          </li>
          <li>
            <strong>Телефон:</strong>{" "}
            {company.phone ? (
              <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>
                {formatPhone(company.phone)}
              </a>
            ) : (
              "в демо-настройках не указан"
            )}
          </li>
          <li>
            <strong>Почта:</strong> <a href={`mailto:${company.email}`}>{company.email}</a>
          </li>
          <li>
            <strong>Юридическая подпись:</strong> {company.legalName}
          </li>
        </ul>
      </section>

      <section>
        <h2>Как заказать</h2>
        <p>
          Соберите заказ в меню, проверьте состав и отправьте заявку. Приватная ссылка на заказ
          появится сразу после сохранения — сохраните её, чтобы видеть статус и сообщения кухни.
        </p>
        <p>
          <Link href="/#menu" className="btn btn--primary btn--small">
            Перейти в меню
          </Link>
        </p>
      </section>

      <section>
        <h2>Что уточнить перед заказом</h2>
        <ul>
          <li>актуальное время приготовления и доставки;</li>
          <li>состав и аллергены — по телефону или в комментарии к заказу;</li>
          <li>стоимость своего блюда: пришлите описание и фото, мы ответим после просмотра;</li>
          <li>выезд за город: доступен только для доставки и оплачивается отдельно.</li>
        </ul>
      </section>

      <section>
        <h2>Техническая поддержка демо</h2>
        <p>
          Проект создан как переносимый MVP. Инструкции по запуску, переменные окружения и
          ограничения описаны в README рядом с исходным кодом. Если сайт не открывается, проверьте,
          запущен ли сервер и доступна ли база данных.
        </p>
      </section>
    </LegalShell>
  );
}
