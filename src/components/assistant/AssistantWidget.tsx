"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { STARTER_CHIPS, type AssistantReply } from "@/lib/assistant/types";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply;
}

const INITIAL_REPLY: AssistantReply = {
  intent: "greeting",
  source: "local",
  text: "Здравствуйте! Я помощник «Тёплого бокса». Подскажу по меню и ценам, доставке, самовывозу и статусу заказа.",
  chips: STARTER_CHIPS,
};

const HIDDEN_PREFIXES = ["/admin", "/order", "/checkout", "/offline"];

export function AssistantWidget() {
  const pathname = usePathname();
  const { addItem, openCart } = useCart();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: "assistant", text: INITIAL_REPLY.text, reply: INITIAL_REPLY },
  ]);
  const idRef = useRef(0);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, pending, open]);

  const hidden =
    !pathname || HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!mounted || hidden) return null;

  async function send(value: string) {
    const text = value.trim();
    if (!text || pending) return;
    const history = messages.slice(-6).map((message) => ({
      role: message.role,
      text: message.text,
    }));
    idRef.current += 1;
    const userMessage: ChatMessage = { id: idRef.current, role: "user", text };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; reply?: AssistantReply }
        | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Не удалось получить ответ. Попробуйте ещё раз.");
      }
      const reply = data?.reply;
      if (!reply || typeof reply.text !== "string") {
        throw new Error("Помощник не ответил. Попробуйте переформулировать вопрос.");
      }
      idRef.current += 1;
      setMessages((current) => [
        ...current,
        { id: idRef.current, role: "assistant", text: reply.text, reply },
      ]);
    } catch (error) {
      idRef.current += 1;
      setMessages((current) => [
        ...current,
        {
          id: idRef.current,
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "Не удалось связаться с помощником. Проверьте соединение.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function handleAdd(message: ChatMessage) {
    if (!message.reply?.add) return;
    addItem(message.reply.add.line);
    setAdded((current) => new Set(current).add(message.id));
    openCart();
  }

  const lastId = messages[messages.length - 1]?.id;

  return (
    <>
      {open ? (
        <section
          id="assistant-panel"
          className="assistant-panel"
          role="dialog"
          aria-label="Помощник «Тёплого бокса»"
          data-testid="assistant-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <header className="assistant-head">
            <div className="assistant-head__title">
              <span className="assistant-head__dot" aria-hidden="true" />
              <div>
                <strong>Помощник</strong>
                <small>Отвечает по данным кафе</small>
              </div>
            </div>
            <button
              type="button"
              className="assistant-close"
              onClick={() => setOpen(false)}
              aria-label="Закрыть помощника"
              data-testid="assistant-close"
            >
              ×
            </button>
          </header>

          <div
            className="assistant-messages"
            ref={messagesRef}
            aria-live="polite"
            aria-relevant="additions text"
            data-testid="assistant-messages"
          >
            {messages.map((message) => {
              const reply = message.reply;
              const isLast = message.id === lastId;
              return (
                <div
                  key={message.id}
                  className={`assistant-msg assistant-msg--${message.role}`}
                >
                  <p>{message.text}</p>
                  {reply?.bullets && reply.bullets.length > 0 ? (
                    <ul className="assistant-bullets">
                      {reply.bullets.map((bullet, index) => (
                        <li key={index}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                  {reply?.add ? (
                    <div className="assistant-actions">
                      <button
                        type="button"
                        className="btn btn--primary assistant-add"
                        onClick={() => handleAdd(message)}
                        disabled={added.has(message.id)}
                        data-testid="assistant-add"
                      >
                        {added.has(message.id) ? "Добавлено" : reply.add.label}
                      </button>
                    </div>
                  ) : null}
                  {reply?.link ? (
                    <div className="assistant-actions">
                      <Link
                        className="assistant-link"
                        href={reply.link.href}
                        onClick={() => setOpen(false)}
                      >
                        {reply.link.label} →
                      </Link>
                    </div>
                  ) : null}
                  {isLast && reply?.chips && reply.chips.length > 0 ? (
                    <div className="assistant-chips">
                      {reply.chips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => void send(chip)}
                          disabled={pending}
                          data-testid="assistant-chip"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {pending ? (
              <div className="assistant-typing" aria-label="Помощник печатает">
                <span />
                <span />
                <span />
              </div>
            ) : null}
          </div>

          <form
            className="assistant-form"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <label className="sr-only" htmlFor="assistant-input">
              Вопрос помощнику
            </label>
            <input
              id="assistant-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Спросите про меню, доставку…"
              maxLength={600}
              autoComplete="off"
              data-testid="assistant-input"
            />
            <button
              type="submit"
              className="assistant-send"
              disabled={pending || input.trim().length === 0}
              aria-label="Отправить вопрос"
              data-testid="assistant-send"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 12h15" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </section>
      ) : (
        <button
          type="button"
          className="assistant-launcher"
          onClick={() => setOpen(true)}
          aria-controls="assistant-panel"
          aria-label="Открыть помощника"
          data-testid="assistant-launcher"
        >
          <span className="assistant-launcher__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-3.2-.6L3 21l1.7-5.1a8.1 8.1 0 0 1-.7-3.4 8.4 8.4 0 0 1 8.5-8.5 8.4 8.4 0 0 1 8.5 7.5Z" />
              <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
            </svg>
          </span>
          <span className="assistant-launcher__label">Спросить</span>
        </button>
      )}
    </>
  );
}
