"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);

function toSafeString(value, fallback = "") {
  const str = String(value ?? "").trim();
  return str || fallback;
}

function toSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function mergeBranding(store, privateStore) {
  const publicBranding =
    store?.branding && typeof store.branding === "object" ? store.branding : {};

  const privateBranding =
    privateStore?.branding && typeof privateStore.branding === "object"
      ? privateStore.branding
      : {};

  return {
    ...publicBranding,
    ...privateBranding,
  };
}

function buildAppearance(branding = {}) {
  const themeColor = toSafeString(branding?.themeColor, "#128c7e");
  const buttonColor = toSafeString(
    branding?.buttonColor || branding?.accentColor,
    "#25d366"
  );

  return {
    pageBackground: toSafeString(branding?.pageBackground, "#f5f7fb"),
    cardBackground: toSafeString(branding?.cardBackground, "#ffffff"),
    textColor: toSafeString(branding?.textColor, "#111827"),
    mutedTextColor: toSafeString(branding?.mutedTextColor, "#6b7280"),
    borderColor: toSafeString(
      branding?.borderColor,
      "rgba(15, 23, 42, 0.08)"
    ),
    dangerColor: toSafeString(branding?.dangerColor, "#dc2626"),
    softSectionBackground: toSafeString(
      branding?.softSectionBackground,
      "rgba(18, 140, 126, 0.05)"
    ),
    subtleSurface: toSafeString(
      branding?.subtleSurface,
      "rgba(18, 140, 126, 0.04)"
    ),
    themeColor,
    buttonColor,
  };
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [storeInfo, setStoreInfo] = useState(null);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("cart_items");
      const savedStore = localStorage.getItem("cart_store");

      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        if (Array.isArray(parsedCart)) {
          setCartItems(parsedCart);
        }
      }

      if (savedStore) {
        const parsedStore = JSON.parse(savedStore);
        if (parsedStore && typeof parsedStore === "object") {
          setStoreInfo(parsedStore);
        }
      }
    } catch (err) {
      console.error("Cart load error:", err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cart_items", JSON.stringify(cartItems));
    } catch (err) {
      console.error("Cart save error:", err);
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      if (storeInfo) {
        localStorage.setItem("cart_store", JSON.stringify(storeInfo));
      } else {
        localStorage.removeItem("cart_store");
      }
    } catch (err) {
      console.error("Store save error:", err);
    }
  }, [storeInfo]);

  const buildStoreSnapshot = (store, privateStore = null) => {
    const branding = mergeBranding(store, privateStore);
    const appearance = buildAppearance(branding);

    return {
      id: toSafeString(store?.id),
      storeName: toSafeString(store?.storeName),
      storeDescription: toSafeString(
        privateStore?.storeDescription || store?.storeDescription
      ),
      slug: toSafeString(store?.slug),

      isActive: store?.isActive !== false,

      acceptOrdersNow: privateStore?.storeTimings?.acceptOrdersNow !== false,
      vacationMode: privateStore?.storeTimings?.vacationMode === true,
      temporaryClosure: privateStore?.storeTimings?.temporaryClosure === true,

      minimumOrderAmount: toSafeNumber(
        privateStore?.orderSettings?.minimumOrderAmount,
        0
      ),
      maximumOrderQuantity: toSafeNumber(
        privateStore?.orderSettings?.maximumOrderQuantity,
        0
      ),
      codLimitAmount: toSafeNumber(
        privateStore?.orderSettings?.codLimitAmount,
        0
      ),

      deliveryEnabled: privateStore?.deliverySettings?.deliveryEnabled !== false,
      deliveryCharge: toSafeNumber(
        privateStore?.deliverySettings?.deliveryCharge,
        0
      ),
      freeDeliveryThreshold: toSafeNumber(
        privateStore?.deliverySettings?.freeDeliveryThreshold,
        0
      ),

      codEnabled: privateStore?.paymentMethods?.codEnabled !== false,
      razorpayEnabled: store?.paymentConfig?.razorpayEnabled === true,

      showOutOfStock:
        privateStore?.catalogSettings?.showOutOfStock !== false,

      branding,
      appearance,
    };
  };

  const addToCart = (product, store, privateStore = null) => {
    if (!product?.id || !store?.id) return;

    const nextStoreId = toSafeString(store?.id);

    if (storeInfo && toSafeString(storeInfo?.id) !== nextStoreId) {
      const confirmReplace = window.confirm(
        "Cart has items from another store. Clear cart?"
      );

      if (!confirmReplace) return;

      setCartItems([]);
    }

    setStoreInfo(buildStoreSnapshot(store, privateStore));

    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      const stockValue = toSafeNumber(product?.stock, 0);

      if (existing) {
        if (existing.quantity >= stockValue) {
          alert(`Only ${stockValue} items available`);
          return prev;
        }

        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          id: product.id,
          name: toSafeString(product?.name, "Product"),
          category: toSafeString(product?.category),
          price: toSafeNumber(product?.price, 0),
          quantity: 1,
          stock: stockValue,
          image: product?.images?.[0] || product?.image || "",
          storeId: nextStoreId,
        },
      ];
    });
  };

  const updateQuantity = (id, qty) => {
    const safeQty = Number(qty);

    if (!Number.isFinite(safeQty) || safeQty <= 0) {
      return removeFromCart(id);
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (safeQty > toSafeNumber(item?.stock, 0)) {
          alert(`Only ${item.stock} items available`);
          return item;
        }

        return { ...item, quantity: safeQty };
      })
    );
  };

  const removeFromCart = (id) => {
    setCartItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);

      if (updated.length === 0) {
        setStoreInfo(null);
      }

      return updated;
    });
  };

  const clearCart = () => {
    setCartItems([]);
    setStoreInfo(null);
  };

  const cartCount = useMemo(() => {
    return cartItems.reduce(
      (sum, item) => sum + toSafeNumber(item?.quantity, 0),
      0
    );
  }, [cartItems]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce(
      (sum, item) =>
        sum +
        toSafeNumber(item?.price, 0) * toSafeNumber(item?.quantity, 0),
      0
    );
  }, [cartItems]);

  const deliveryCharge = useMemo(() => {
    if (!storeInfo) return 0;
    if (!storeInfo.deliveryEnabled) return 0;

    if (
      toSafeNumber(storeInfo?.freeDeliveryThreshold, 0) > 0 &&
      cartTotal >= toSafeNumber(storeInfo?.freeDeliveryThreshold, 0)
    ) {
      return 0;
    }

    return toSafeNumber(storeInfo?.deliveryCharge, 0);
  }, [storeInfo, cartTotal]);

  const finalTotal = toSafeNumber(cartTotal, 0) + toSafeNumber(deliveryCharge, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        storeInfo,
        cartCount,
        cartTotal,
        deliveryCharge,
        finalTotal,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("CartProvider missing");
  }
  return ctx;
}