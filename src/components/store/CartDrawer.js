"use client";

import Link from "next/link";
import useCart from "@/hooks/useCart";

export default function CartDrawer() {
  const { cartItems, cartCount, cartTotal } = useCart();

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];
  const safeCartCount = Number(cartCount || 0);
  const safeCartTotal = Number(cartTotal || 0);

  return (
    <div className="bg-white border rounded-2xl p-4">
      <h3 className="text-lg font-semibold mb-4">Cart Summary</h3>

      {safeCartItems.length === 0 ? (
        <p className="text-sm text-gray-600">No items in cart.</p>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {safeCartItems.slice(0, 3).map((item, index) => {
              const price = Number(item?.price || 0);
              const quantity = Number(item?.quantity || 0);
              const subtotal = price * quantity;

              return (
                <div
                  key={item?.id || `${item?.name || "item"}-${index}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate pr-3">
                    {item?.name || "Item"} × {quantity}
                  </span>
                  <span>₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t pt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Total Items</span>
              <span>{safeCartCount}</span>
            </div>

            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>₹{safeCartTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <Link
            href="/cart"
            className="mt-4 block w-full text-center bg-black text-white rounded-lg py-3"
          >
            View Cart
          </Link>
        </>
      )}
    </div>
  );
}