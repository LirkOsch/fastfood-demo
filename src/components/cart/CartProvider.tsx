"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CartLineInput } from "@/lib/pricing";
import type { OptionId, VariantId } from "@/lib/menu";

const STORAGE_KEY = "tb-cart-v1";
const UNDO_MS = 6500;

interface RemovedLine {
  line: CartLineInput;
  index: number;
}

interface CartContextValue {
  lines: CartLineInput[];
  hydrated: boolean;
  count: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (line: CartLineInput) => void;
  updateQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  undoRemove: () => void;
  clearCart: () => void;
  removed: RemovedLine | null;
}

const CartContext = createContext<CartContextValue | null>(null);

function isVariant(value: unknown): value is VariantId {
  return value === "standard" || value === "large" || value === "single";
}

function isOption(value: unknown): value is OptionId {
  return value === "double" || value === "sauce";
}

function sanitizeLine(value: unknown): CartLineInput | null {
  if (!value || typeof value !== "object") return null;
  const line = value as Record<string, unknown>;
  if (typeof line.key !== "string" || line.key.length === 0 || line.key.length > 240) {
    return null;
  }
  if (typeof line.itemId !== "string" || line.itemId.length === 0) return null;
  if (!isVariant(line.variant)) return null;
  if (typeof line.qty !== "number" || !Number.isFinite(line.qty)) return null;
  const options = Array.isArray(line.options)
    ? [...new Set(line.options.filter(isOption))]
    : [];
  const qty = Math.max(1, Math.min(50, Math.trunc(line.qty)));
  return {
    key: line.key,
    itemId: line.itemId,
    variant: line.variant,
    qty,
    options,
    customDescription:
      typeof line.customDescription === "string"
        ? line.customDescription.slice(0, 600)
        : undefined,
  };
}

function readStoredCart(): CartLineInput[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: CartLineInput[] = [];
    for (const entry of parsed) {
      const line = sanitizeLine(entry);
      if (line && !result.some((existing) => existing.key === line.key)) {
        result.push(line);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLineInput[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [removed, setRemoved] = useState<RemovedLine | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLines(readStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Переполненное или недоступное хранилище не должно ломать корзину.
    }
  }, [lines, hydrated]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const scheduleUndoClear = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS);
  }, []);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback(
    (incoming: CartLineInput) => {
      setRemoved(null);
      setLines((current) => {
        const cleaned = sanitizeLine(incoming);
        if (!cleaned) return current;
        const isCustom = cleaned.itemId === "custom";
        const existingIndex = current.findIndex((line) =>
          isCustom ? line.itemId === "custom" : line.key === cleaned.key,
        );
        if (existingIndex >= 0) {
          const next = [...current];
          const existing = next[existingIndex]!;
          next[existingIndex] = {
            ...existing,
            qty: isCustom
              ? 1
              : Math.max(1, Math.min(50, existing.qty + cleaned.qty)),
            customDescription: cleaned.customDescription ?? existing.customDescription,
          };
          return next;
        }
        return [...current, { ...cleaned, qty: isCustom ? 1 : cleaned.qty }];
      });
    },
    [],
  );

  const updateQty = useCallback((key: string, qty: number) => {
    setLines((current) => {
      const next = Math.max(0, Math.min(50, Math.trunc(qty)));
      if (next === 0) return current.filter((line) => line.key !== key);
      return current.map((line) => (line.key === key ? { ...line, qty: next } : line));
    });
  }, []);

  const removeLine = useCallback(
    (key: string) => {
      setLines((current) => {
        const index = current.findIndex((line) => line.key === key);
        if (index < 0) return current;
        setRemoved({ line: current[index]!, index });
        scheduleUndoClear();
        return current.filter((line) => line.key !== key);
      });
    },
    [scheduleUndoClear],
  );

  const undoRemove = useCallback(() => {
    setRemoved((entry) => {
      if (!entry) return null;
      setLines((current) => {
        if (current.some((line) => line.key === entry.line.key)) return current;
        const next = [...current];
        next.splice(Math.min(entry.index, next.length), 0, entry.line);
        return next;
      });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      return null;
    });
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    setRemoved(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const count = useMemo(
    () => lines.reduce((sum, line) => sum + (line.itemId === "custom" ? 1 : line.qty), 0),
    [lines],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      hydrated,
      count,
      isOpen,
      openCart,
      closeCart,
      addItem,
      updateQty,
      removeLine,
      undoRemove,
      clearCart,
      removed,
    }),
    [
      lines,
      hydrated,
      count,
      isOpen,
      openCart,
      closeCart,
      addItem,
      updateQty,
      removeLine,
      undoRemove,
      clearCart,
      removed,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {removed ? (
        <div className="undo-toast" role="status">
          <span>«{removed.line.itemId === "custom" ? "Своё блюдо" : "Позиция"}» удалена</span>
          <button type="button" onClick={undoRemove}>
            Вернуть
          </button>
        </div>
      ) : null}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
