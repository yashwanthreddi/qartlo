"use client";

import { Heart, ShoppingCart } from "lucide-react";

function getSafeColor(color, fallback) {
  const value = String(color || "").trim();
  return value || fallback;
}

export default function StoreHeader({
  storeName = "My Store",
  storeDescription = "",
  storeLogo = "",
  themeColor = "#128c7e",
  cartCount = 0,
  onCartClick,
  wishlistEnabled = false,
  onWishlistClick,
}) {
  const headerBg = getSafeColor(themeColor, "#128c7e");

  const safeStoreName =
    typeof storeName === "string" && storeName.trim()
      ? storeName
      : "My Store";

  const safeDescription =
    typeof storeDescription === "string" && storeDescription.trim()
      ? storeDescription
      : "";

  const safeCartCount = Number(cartCount || 0);
  const displayCount =
    safeCartCount > 99 ? "99+" : safeCartCount;

  const logoUrl =
    typeof storeLogo === "string" && storeLogo.trim()
      ? storeLogo
      : "";

  return (
    <header
      className="sticky top-0 z-50 text-white shadow-sm"
      style={{ backgroundColor: headerBg }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/15">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={safeStoreName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-extrabold uppercase text-white">
                {safeStoreName.charAt(0) || "S"}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-bold leading-tight">
              {safeStoreName}
            </h1>

            {safeDescription ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-white/85">
                {safeDescription}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {wishlistEnabled ? (
            <button
              type="button"
              onClick={() => onWishlistClick?.()}
              className="rounded-full bg-white/10 p-2.5 transition hover:bg-white/15"
              aria-label="Open wishlist"
            >
              <Heart size={20} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onCartClick?.()}
            className="relative rounded-full bg-white/10 p-2.5 transition hover:bg-white/15"
            aria-label="Open cart"
          >
            <ShoppingCart size={22} />

            {safeCartCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ff6b35] px-1 text-[10px] font-bold text-white">
                {displayCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
}