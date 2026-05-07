"use client";

function getSafeColor(color, fallback) {
  const value = String(color || "").trim();
  return value || fallback;
}

export default function ProductCard({
  product,
  onAddToCart,
  onClick,
  themeColor = "#128c7e",
  buttonColor = "#25d366",
  productCardStyle = "standard",
}) {
  const safeProduct = product || {};
  const priceColor = getSafeColor(themeColor, "#128c7e");
  const addButtonColor = getSafeColor(buttonColor, "#25d366");

  const stockValue = Number(safeProduct?.stock ?? 0);
  const safeStockValue = Number.isFinite(stockValue) ? stockValue : 0;
  const isOutOfStock = safeStockValue <= 0;

  const imageUrl =
    (Array.isArray(safeProduct?.images) && safeProduct.images[0]) ||
    safeProduct?.image ||
    "";

  const isCompact = productCardStyle === "compact";
  const isPremium = productCardStyle === "premium";

  const productName =
    typeof safeProduct?.name === "string" && safeProduct.name.trim()
      ? safeProduct.name
      : "Product";

  const productCategory =
    typeof safeProduct?.category === "string" && safeProduct.category.trim()
      ? safeProduct.category
      : "";

  const productDescription =
    typeof safeProduct?.description === "string" && safeProduct.description.trim()
      ? safeProduct.description
      : "";

  const productPrice = Number(safeProduct?.price || 0);
  const safeProductPrice = Number.isFinite(productPrice) ? productPrice : 0;

  return (
    <div
      onClick={() => onClick?.(safeProduct)}
      className={`relative cursor-pointer overflow-hidden border bg-white ${
        isPremium
          ? "rounded-3xl shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          : isCompact
          ? "rounded-2xl shadow-sm"
          : "rounded-2xl shadow-sm"
      }`}
    >
      <div
        className={`flex items-center justify-center bg-gray-100 ${
          isCompact ? "h-40" : isPremium ? "h-60" : "h-52"
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm text-gray-400">No Image</span>
        )}
      </div>

      <div className={isCompact ? "p-3" : "p-4"}>
        <h3 className={isPremium ? "text-xl font-bold" : "text-lg font-semibold"}>
          {productName}
        </h3>

        {productCategory ? (
          <p className="mt-1 text-sm text-gray-500">{productCategory}</p>
        ) : null}

        {productDescription ? (
          <p className="mt-2 line-clamp-2 text-sm text-gray-600">
            {productDescription}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold" style={{ color: priceColor }}>
              ₹{safeProductPrice.toLocaleString("en-IN")}
            </p>
            {isOutOfStock ? (
              <p className="mt-1 text-xs font-semibold text-red-600">
                Out of stock
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart?.(safeProduct);
            }}
            style={{
              backgroundColor: isOutOfStock ? "#9ca3af" : addButtonColor,
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              isOutOfStock ? "cursor-not-allowed" : ""
            }`}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}