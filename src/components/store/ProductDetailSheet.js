"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

function getSafeColor(color, fallback) {
  return String(color || "").trim() || fallback;
}

function getUniqueImages(product) {
  if (!product) return [];

  const images = [];

  if (product.image) {
    images.push(product.image);
  }

  if (Array.isArray(product.images)) {
    images.push(...product.images);
  }

  return [...new Set(images.filter(Boolean))].slice(0, 4);
}

export default function ProductDetailSheet({
  product,
  onClose,
  onAdd,
  store = {},
  privateStore = {},
}) {
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const images = useMemo(() => getUniqueImages(product), [product]);

  useEffect(() => {
    if (product) {
      setQty(1);
      setActiveImage(0);
    }
  }, [product]);

  if (!product) return null;

  const stockRaw = Number(product?.stock ?? 0);
  const stockValue = Number.isFinite(stockRaw) ? stockRaw : 0;

  const isOutOfStock = stockValue <= 0;
  const isLowStock = stockValue > 0 && stockValue <= 5;

  const showOutOfStock = store?.catalogConfig?.showOutOfStock !== false;
  if (isOutOfStock && !showOutOfStock) return null;

  const priceRaw = Number(product?.price || 0);
  const price = Number.isFinite(priceRaw) ? priceRaw : 0;

  const totalPrice = price * qty;

  const themeColor = getSafeColor(store?.branding?.themeColor, "#128c7e");
  const buttonColor = getSafeColor(store?.branding?.buttonColor, "#25d366");

  const isStoreDisabled =
    store?.isActive === false ||
    privateStore?.storeTimings?.acceptOrdersNow === false ||
    privateStore?.storeTimings?.vacationMode === true ||
    privateStore?.storeTimings?.temporaryClosure === true;

  const handleIncrease = () => {
    if (qty >= stockValue) {
      alert(`Only ${stockValue} items remaining`);
      return;
    }

    setQty((q) => q + 1);
  };

  const handleDecrease = () => {
    setQty((q) => Math.max(1, q - 1));
  };

  const handleAdd = () => {
    if (isStoreDisabled) {
      alert("Store is not accepting orders");
      return;
    }

    if (isOutOfStock) {
      alert("This product is out of stock");
      return;
    }

    if (qty > stockValue) {
      alert(`Only ${stockValue} items remaining`);
      return;
    }

    onAdd?.(product, qty);
    onClose?.();
  };

  const goPrev = () => {
    if (images.length <= 1) return;

    setActiveImage((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  const goNext = () => {
    if (images.length <= 1) return;

    setActiveImage((prev) =>
      prev === images.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/55"
      onClick={() => onClose?.()}
    >
      <div
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur">
          <div className="flex justify-center pt-3">
            <div className="h-1.5 w-14 rounded-full bg-gray-300" />
          </div>

          <div className="absolute right-4 top-4">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-gray-200"
              aria-label="Close product details"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3">
          <div className="relative overflow-hidden rounded-[24px] bg-[#f6f7f9]">
            {images.length > 0 ? (
              <>
                <div className="flex h-[320px] items-center justify-center">
                  <img
                    src={images[activeImage]}
                    alt={product?.name || "Product image"}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                {images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={22} />
                    </button>

                    <button
                      type="button"
                      onClick={goNext}
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"
                      aria-label="Next image"
                    >
                      <ChevronRight size={22} />
                    </button>

                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                      {activeImage + 1} / {images.length}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="flex h-[320px] items-center justify-center text-gray-400">
                No image
              </div>
            )}
          </div>

          {images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-gray-100 ${
                    activeImage === index
                      ? "border-gray-900"
                      : "border-gray-200"
                  }`}
                  aria-label={`Open image ${index + 1}`}
                >
                  <img
                    src={image}
                    alt={`${product?.name || "Product"} ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="px-4 pb-28 pt-5">
          <h2 className="text-xl font-bold">
            {product?.name || "Product"}
          </h2>

          <div className="mt-2 text-lg font-bold" style={{ color: themeColor }}>
            ₹{price.toLocaleString("en-IN")}
          </div>

          <div className="mt-3">
            {isOutOfStock ? (
              <span className="font-medium text-red-500">Out of stock</span>
            ) : (
              <span className="text-sm text-gray-700">
                Available: {stockValue}
                {isLowStock ? ` (Only ${stockValue} left)` : ""}
              </span>
            )}
          </div>

          {product?.description ? (
            <p className="mt-4 text-sm text-gray-600">
              {product.description}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t bg-white p-4">
          <div className="flex items-center justify-between">
            {!isOutOfStock ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecrease}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-lg font-bold"
                >
                  -
                </button>

                <span className="min-w-[24px] text-center font-semibold">
                  {qty}
                </span>

                <button
                  type="button"
                  onClick={handleIncrease}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-lg font-bold"
                >
                  +
                </button>
              </div>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleAdd}
              disabled={isOutOfStock || isStoreDisabled}
              style={{ backgroundColor: buttonColor }}
              className="rounded-full px-6 py-3 text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isStoreDisabled
                ? "Unavailable"
                : isOutOfStock
                  ? "Out of Stock"
                  : `Add ${qty} • ₹${totalPrice.toLocaleString("en-IN")}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}