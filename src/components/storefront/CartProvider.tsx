"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "moto-store-cart";

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function persistCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function CartProvider({ children }: { children: React.ReactNode}) {
  const [items, setItems] = useState<CartItem[]>(() => readStoredCart());

  useEffect(() => {
    persistCart(items);
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);

    return {
      items,
      itemCount,
      subtotal,
      addItem(item, qty = 1) {
        setItems((prev) => {
          const existing = prev.find((p) => p.productId === item.productId);
          const next = existing
            ? prev.map((p) =>
                p.productId === item.productId
                  ? { ...p, quantity: Math.min(99, p.quantity + qty) }
                  : p
              )
            : [...prev, { ...item, quantity: qty }];
          return next;
        });
      },
      updateQuantity(productId, quantity) {
        setItems((prev) =>
          quantity <= 0
            ? prev.filter((p) => p.productId !== productId)
            : prev.map((p) =>
                p.productId === productId ? { ...p, quantity: Math.min(99, quantity) } : p
              )
        );
      },
      removeItem(productId) {
        setItems((prev) => prev.filter((p) => p.productId !== productId));
      },
      clear() {
        setItems([]);
      },
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
