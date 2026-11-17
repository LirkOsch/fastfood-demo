import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/site/LegalShell";
import { getAppSettings } from "@/lib/db";
import { formatPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Контакты",
  description: "Адрес самовывоза, часы работы, телефон и почта для связи.",
  alternates: { canonical: "/contacts" },
};

export default async function ContactsPage() {
  const settings = await getAppSettings();
  const { company } = settings;
  return (
    <LegalShell
      company={company}
      title="Контакты"
      meta="Свяжитесь с нами по телефону или почте — либо оформите заказ на сайте."
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
              "не указан"
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
        <h2>Если что-то не работает</h2>
        <p>
          Если сайт не открывается или заказ не отправился, позвоните по телефону{" "}
          {company.phone ? (
            <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>{formatPhone(company.phone)}</a>
          ) : (
            "из раздела выше"
          )}{" "}
          или напишите на <a href={`mailto:${company.email}`}>{company.email}</a>. Не отправляйте
          заказ повторно, пока не уточните, сохранился ли он: страница заказа открывается по
          приватной ссылке.
        </p>
      </section>
    </LegalShell>
  );
}
