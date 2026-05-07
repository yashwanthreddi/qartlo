"use client";

function getSafeColor(color, fallback) {
  const value = String(color || "").trim();
  return value || fallback;
}

export default function StoreProductListItem({
  product,
  onClick,
  onAdd,
  onIncrease,
  onDecrease,
  quantity = 0,
  stock = 0,
  inStock = true,
  lowStock = false,
  lowStockText = "",
  themeColor = "#128c7e",
  buttonColor = "#25d366",
  productCardStyle = "standard",
}) {
  const safeProduct = product || {};

  /* ✅ SAFE STOCK */
  const stockRaw = Number(stock ?? safeProduct?.stock ?? 0);
  const stockValue = Number.isFinite(stockRaw) ? stockRaw : 0;

  const isOutOfStock = !inStock || stockValue <= 0;
  const isLowStock = !isOutOfStock && (lowStock || stockValue <= 5);

  /* ✅ SAFE COLORS */
  const priceColor = getSafeColor(themeColor, "#128c7e");
  const addButtonColor = getSafeColor(buttonColor, "#25d366");

  /* ✅ SAFE IMAGE */
  const imageUrl =
    (Array.isArray(safeProduct?.images) && safeProduct.images[0]) ||
    safeProduct?.image ||
    "";

  /* ✅ SAFE VALUES */
  const safeQuantity = Number.isFinite(Number(quantity))
    ? Number(quantity)
    : 0;

  const priceRaw = Number(safeProduct?.price || 0);
  const price = Number.isFinite(priceRaw) ? priceRaw : 0;

  const productName =
    typeof safeProduct?.name === "string" && safeProduct.name.trim()
      ? safeProduct.name
      : "Product";

  const productDescription =
    typeof safeProduct?.description === "string" &&
    safeProduct.description.trim()
      ? safeProduct.description
      : "";

  /* ---------------- STYLE ---------------- */

  const isCompact = productCardStyle === "compact";
  const isPremium = productCardStyle === "premium";

  const wrapperClass = isCompact
    ? `flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2.5 active:bg-gray-50 ${
        isOutOfStock ? "bg-red-50" : "bg-white"
      }`
    : isPremium
    ? `flex cursor-pointer items-center gap-4 rounded-3xl border px-4 py-4 shadow-sm transition hover:shadow-md ${
        isOutOfStock ? "border-red-100 bg-red-50" : "border-gray-200 bg-white"
      }`
    : `flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3 active:bg-gray-50 ${
        isOutOfStock ? "bg-red-50" : "bg-white"
      }`;

  const imageBoxClass = isCompact
    ? "flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f0f2f5]"
    : isPremium
    ? "flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f0f2f5] ring-1 ring-black/5"
    : "flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f0f2f5]";

  const titleClass = isCompact
    ? "truncate text-[13px] font-semibold text-gray-900"
    : isPremium
    ? "truncate text-[15px] font-bold text-gray-900"
    : "truncate text-[14px] font-semibold text-gray-900";

  const descClass = isCompact
    ? "mt-[2px] truncate text-[11px] text-gray-500"
    : isPremium
    ? "mt-[3px] truncate text-[12px] text-gray-500"
    : "mt-[2px] truncate text-[12px] text-gray-500";

  const priceClass = isCompact
    ? "mt-[3px] text-[13px] font-bold"
    : isPremium
    ? "mt-[5px] text-[15px] font-extrabold"
    : "mt-[4px] text-[14px] font-bold";

  const badgeClass = isCompact
    ? "rounded-full px-2 py-0.5 text-[10px] font-semibold"
    : "rounded-full px-2.5 py-1 text-[11px] font-semibold";

  /* ---------------- UI ---------------- */

  return (
    <div
      onClick={() => onClick?.(safeProduct)}
      className={wrapperClass}
    >
      {/* IMAGE */}
      <div className={imageBoxClass}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-gray-400">
            No Image
          </span>
        )}
      </div>

      {/* CONTENT */}
      <div className="min-w-0 flex-1">
        <h3 className={titleClass}>{productName}</h3>

        {productDescription ? (
          <p className={descClass}>{productDescription}</p>
        ) : null}

        <p className={priceClass} style={{ color: priceColor }}>
          ₹{price.toLocaleString("en-IN")}
        </p>

        <div className="mt-2">
          {isOutOfStock ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${badgeClass} bg-red-100 text-red-700`}>
                Out of Stock
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${badgeClass} bg-green-100 text-green-700`}>
                In Stock
              </span>

              {isLowStock ? (
                <span className={`${badgeClass} bg-orange-100 text-orange-700`}>
                  {lowStockText || `Only ${stockValue} items remaining`}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ACTIONS */}
      <div
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {isOutOfStock ? (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full bg-gray-300 px-3 py-1.5 text-[12px] font-bold text-white"
          >
            Add
          </button>
        ) : safeQuantity > 0 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onDecrease?.(safeProduct)}
              className="flex h-7 w-7 items-center justify-center rounded-full border text-lg font-bold"
              style={{
                borderColor: addButtonColor,
                color: addButtonColor,
              }}
            >
              -
            </button>

            <span className="min-w-[20px] text-center text-sm font-bold">
              {safeQuantity}
            </span>

            <button
              type="button"
              onClick={() => onIncrease?.(safeProduct)}
              disabled={safeQuantity >= stockValue}
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-lg font-bold ${
                safeQuantity >= stockValue
                  ? "cursor-not-allowed border-gray-300 text-gray-300"
                  : ""
              }`}
              style={
                safeQuantity >= stockValue
                  ? undefined
                  : {
                      borderColor: addButtonColor,
                      color: addButtonColor,
                    }
              }
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onAdd?.(safeProduct)}
            className={`rounded-full text-white ${
              isCompact
                ? "px-3 py-1.5 text-[11px] font-bold"
                : isPremium
                ? "px-4 py-2 text-[12px] font-bold shadow-sm"
                : "px-3 py-1.5 text-[12px] font-bold"
            }`}
            style={{ backgroundColor: addButtonColor }}
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}