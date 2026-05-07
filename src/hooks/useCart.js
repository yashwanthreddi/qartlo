"use client";

import { useCartContext } from "@/context/CartContext";

export default function useCart() {
  const context = useCartContext();

  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
}