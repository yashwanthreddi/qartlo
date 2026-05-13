"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import useCart from "@/hooks/useCart";

function formatMoney(val) {
  const num = Number(val || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-IN") : "0";
}

function getSafeColor(value, fallback) {
  const str = String(value || "").trim();
  return str || fallback;
}

function getFontFamily(fontStyle) {
  switch (String(fontStyle || "").toLowerCase()) {
    case "poppins":
      return "Poppins, sans-serif";
    case "roboto":
      return "Roboto, sans-serif";
    case "lato":
      return "Lato, sans-serif";
    case "inter":
    default:
      return "Inter, sans-serif";
  }
}

function getCardRadius(style) {
  switch (String(style || "").toLowerCase()) {
    case "compact":
      return "16px";
    case "premium":
      return "24px";
    case "standard":
    default:
      return "20px";
  }
}

function normalizeHex(hex) {
  let color = String(hex || "").replace("#", "").trim();

  if (color.length === 3) {
    color = color
      .split("")
      .map((c) => c + c)
      .join("");
  }

  return color.length === 6 ? color : null;
}

function hexToRgba(hex, alpha = 1) {
  const color = normalizeHex(hex);
  if (!color) return `rgba(15, 23, 42, ${alpha})`;

  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getContrastTextColor(hex, dark = "#111827", light = "#ffffff") {
  const color = normalizeHex(hex);
  if (!color) return light;

  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? dark : light;
}

export default function CustomDomainCartPage() {
  const router = useRouter();

  const {
    cartItems,
    storeInfo,
    cartTotal,
    deliveryCharge,
    finalTotal,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];
  const branding = storeInfo?.branding || {};
  const appearance = storeInfo?.appearance || {};

  const totalItems = safeCartItems.reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0
  );

  const minimumOrder = Number(storeInfo?.minimumOrderAmount || 0);

  const isStoreClosed =
    storeInfo?.isActive === false ||
    storeInfo?.acceptOrdersNow === false ||
    storeInfo?.vacationMode === true ||
    storeInfo?.temporaryClosure === true;

  const canCheckout =
    !isStoreClosed &&
    safeCartItems.length > 0 &&
    Number(cartTotal || 0) >= minimumOrder &&
    !!storeInfo?.slug;

  const themeColor = getSafeColor(
    branding?.themeColor || branding?.primaryColor,
    "#128c7e"
  );

  const buttonColor = getSafeColor(
    branding?.buttonColor || branding?.primaryColor,
    themeColor
  );

  const accentColor = getSafeColor(
    branding?.accentColor || branding?.secondaryColor,
    "#25d366"
  );

  const pageBg = getSafeColor(appearance?.pageBackground, "#f5f7fb");
  const cardBg = getSafeColor(appearance?.cardBackground, "#ffffff");
  const textColor = getSafeColor(appearance?.textColor, "#111827");
  const mutedTextColor = getSafeColor(appearance?.mutedTextColor, "#6b7280");

  const borderColor = getSafeColor(
    appearance?.borderColor,
    "rgba(15, 23, 42, 0.08)"
  );

  const dangerColor = getSafeColor(appearance?.dangerColor, "#dc2626");

  const softSectionBg = getSafeColor(
    appearance?.softSectionBackground,
    hexToRgba(themeColor, 0.05)
  );

  const subtleSurface = getSafeColor(
    appearance?.subtleSurface,
    hexToRgba(themeColor, 0.04)
  );

  const fontFamily = getFontFamily(branding?.fontStyle);
  const cardRadius = getCardRadius(branding?.productCardStyle);

  const headerTextColor = getContrastTextColor(themeColor);
  const buttonTextColor = getContrastTextColor(buttonColor);
  const cardShadow = `0 10px 30px ${hexToRgba(themeColor, 0.08)}`;
  const headerShadow = `0 4px 18px ${hexToRgba(themeColor, 0.18)}`;
  const checkoutShadow = `0 12px 24px ${hexToRgba(buttonColor, 0.2)}`;

  const handleCheckout = () => {
    if (!storeInfo?.slug) {
      alert("Store information missing");
      return;
    }

    if (isStoreClosed) {
      alert("Store is not accepting orders right now");
      return;
    }

    if (minimumOrder && Number(cartTotal || 0) < minimumOrder) {
      alert(`Minimum order amount is ₹${minimumOrder}`);
      return;
    }

    router.push("/checkout");
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: pageBg,
        color: textColor,
        fontFamily,
      }}
    >
      <div
        className="sticky top-0 z-50 border-b px-4 py-3 backdrop-blur"
        style={{
          backgroundColor: themeColor,
          color: headerTextColor,
          borderColor: hexToRgba(headerTextColor, 0.15),
          boxShadow: headerShadow,
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-sm font-medium"
            style={{ color: headerTextColor }}
          >
            ← Store
          </button>

          <div className="min-w-0 text-center">
            <h1 className="truncate text-base font-bold">Your Cart</h1>
            {storeInfo?.storeName ? (
              <p
                className="truncate text-xs"
                style={{ color: hexToRgba(headerTextColor, 0.85) }}
              >
                {storeInfo.storeName}
              </p>
            ) : null}
          </div>

          {safeCartItems.length > 0 ? (
            <button
              type="button"
              onClick={() => clearCart?.()}
              className="text-sm font-medium"
              style={{ color: headerTextColor }}
            >
              Clear
            </button>
          ) : (
            <div className="w-[44px]" />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-3 pb-36 pt-4 sm:px-4">
        {safeCartItems.length === 0 ? (
          <div
            className="mt-6 overflow-hidden p-8 text-center"
            style={{
              backgroundColor: cardBg,
              borderRadius: cardRadius,
              border: `1px solid ${borderColor}`,
              boxShadow: cardShadow,
            }}
          >
            <div className="text-5xl">🛒</div>

            <h2 className="mt-4 text-xl font-bold" style={{ color: textColor }}>
              Your cart is empty
            </h2>

            <p className="mt-2 text-sm" style={{ color: mutedTextColor }}>
              Add products to continue shopping.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center px-5 py-3 text-sm font-semibold transition active:scale-[0.98]"
              style={{
                backgroundColor: buttonColor,
                color: buttonTextColor,
                borderRadius: "999px",
                boxShadow: `0 10px 20px ${hexToRgba(buttonColor, 0.18)}`,
              }}
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            {isStoreClosed ? (
              <div
                className="mb-3 rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: hexToRgba(dangerColor, 0.25),
                  backgroundColor: hexToRgba(dangerColor, 0.08),
                  color: dangerColor,
                }}
              >
                This store is currently not accepting orders.
              </div>
            ) : null}

            {!storeInfo?.slug ? (
              <div
                className="mb-3 rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: hexToRgba("#d97706", 0.25),
                  backgroundColor: hexToRgba("#d97706", 0.08),
                  color: "#b45309",
                }}
              >
                Store information is missing. Please go back and add the item
                again.
              </div>
            ) : null}

            <div className="space-y-3">
              {safeCartItems.map((item, index) => {
                const price = Number(item?.price || 0);
                const qty = Number(item?.quantity || 0);
                const total = price * qty;
                const imageUrl = item?.image || item?.images?.[0] || "";

                return (
                  <div
                    key={item?.id || `item-${index}`}
                    className="overflow-hidden"
                    style={{
                      backgroundColor: cardBg,
                      borderRadius: cardRadius,
                      border: `1px solid ${borderColor}`,
                      boxShadow: cardShadow,
                    }}
                  >
                    <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                      <div
                        className="h-[78px] w-[78px] shrink-0 overflow-hidden"
                        style={{
                          borderRadius: "16px",
                          backgroundColor: subtleSurface,
                          border: `1px solid ${borderColor}`,
                        }}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item?.name || "Product"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-full items-center justify-center text-xs"
                            style={{ color: mutedTextColor }}
                          >
                            No Image
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3
                              className="truncate text-sm font-semibold sm:text-base"
                              style={{ color: textColor }}
                            >
                              {item?.name || "Product"}
                            </h3>

                            {item?.category ? (
                              <p
                                className="mt-1 truncate text-xs sm:text-sm"
                                style={{ color: mutedTextColor }}
                              >
                                {item.category}
                              </p>
                            ) : null}

                            <p
                              className="mt-2 text-sm font-medium"
                              style={{ color: accentColor }}
                            >
                              ₹{formatMoney(price)} each
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart?.(item.id)}
                            className="shrink-0 text-xs font-semibold sm:text-sm"
                            style={{ color: dangerColor }}
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div
                            className="inline-flex items-center gap-2 p-1"
                            style={{
                              borderRadius: "16px",
                              backgroundColor: softSectionBg,
                              border: `1px solid ${borderColor}`,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => updateQuantity?.(item.id, qty - 1)}
                              disabled={qty <= 1}
                              className="flex h-9 w-9 items-center justify-center text-base font-semibold disabled:opacity-40"
                              style={{
                                borderRadius: "12px",
                                backgroundColor: cardBg,
                                color: themeColor,
                                border: `1px solid ${borderColor}`,
                              }}
                            >
                              −
                            </button>

                            <span
                              className="min-w-[28px] text-center text-sm font-semibold"
                              style={{ color: textColor }}
                            >
                              {qty}
                            </span>

                            <button
                              type="button"
                              onClick={() => updateQuantity?.(item.id, qty + 1)}
                              className="flex h-9 w-9 items-center justify-center text-base font-semibold"
                              style={{
                                borderRadius: "12px",
                                backgroundColor: cardBg,
                                color: themeColor,
                                border: `1px solid ${borderColor}`,
                              }}
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right">
                            <p className="text-xs" style={{ color: mutedTextColor }}>
                              Total
                            </p>
                            <p
                              className="text-sm font-bold sm:text-base"
                              style={{ color: textColor }}
                            >
                              ₹{formatMoney(total)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div
                className="p-4 sm:p-5"
                style={{
                  backgroundColor: cardBg,
                  borderRadius: cardRadius,
                  border: `1px solid ${borderColor}`,
                  boxShadow: cardShadow,
                }}
              >
                <h3 className="mb-4 text-base font-bold" style={{ color: textColor }}>
                  Bill Details
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: mutedTextColor }}>Items Total</span>
                    <span className="font-medium" style={{ color: textColor }}>
                      ₹{formatMoney(cartTotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: mutedTextColor }}>Delivery</span>
                    <span className="font-medium" style={{ color: textColor }}>
                      {Number(deliveryCharge || 0) === 0 ? (
                        <span style={{ color: accentColor }}>Free</span>
                      ) : (
                        `₹${formatMoney(deliveryCharge)}`
                      )}
                    </span>
                  </div>

                  {storeInfo?.freeDeliveryThreshold ? (
                    <p className="text-xs" style={{ color: mutedTextColor }}>
                      Free delivery above ₹
                      {formatMoney(storeInfo.freeDeliveryThreshold)}
                    </p>
                  ) : null}

                  <div
                    className="rounded-xl px-3 py-2 text-xs"
                    style={{
                      backgroundColor: softSectionBg,
                      color: mutedTextColor,
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    Minimum order amount: ₹{formatMoney(minimumOrder)}
                  </div>

                  <div
                    className="flex items-center justify-between pt-3 text-base font-bold"
                    style={{
                      color: textColor,
                      borderTop: `1px dashed ${borderColor}`,
                    }}
                  >
                    <span>Total</span>
                    <span>₹{formatMoney(finalTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur"
              style={{
                borderColor,
                backgroundColor: hexToRgba(cardBg, 0.92),
              }}
            >
              <div className="mx-auto max-w-3xl p-3 sm:p-4">
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={!canCheckout}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-sm font-bold transition active:scale-[0.99] sm:text-base"
                  style={{
                    backgroundColor: canCheckout ? buttonColor : "#9ca3af",
                    color: canCheckout ? buttonTextColor : "#ffffff",
                    borderRadius: "18px",
                    boxShadow: canCheckout ? checkoutShadow : "none",
                  }}
                >
                  <span>₹{formatMoney(finalTotal)}</span>
                  <span>Checkout ({totalItems}) →</span>
                </button>

                {!canCheckout ? (
                  <div
                    className="mt-2 text-center text-xs font-medium"
                    style={{ color: dangerColor }}
                  >
                    {!storeInfo?.slug
                      ? "Store information missing"
                      : isStoreClosed
                        ? "Store is not accepting orders"
                        : minimumOrder > 0 && cartTotal < minimumOrder
                          ? `Minimum order ₹${formatMoney(minimumOrder)} required`
                          : ""}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}