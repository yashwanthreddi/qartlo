"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Script from "next/script";

import { getStoreBySlugOrDomain } from "@/lib/firestore";
import CheckoutForm from "@/components/store/CheckoutForm";
import useCart from "@/hooks/useCart";

function calculateDelivery(cartTotal, deliverySettings = {}) {
  const deliveryCharge = Number(deliverySettings?.deliveryCharge || 0);
  const freeThreshold = Number(deliverySettings?.freeDeliveryThreshold || 0);

  if (freeThreshold > 0 && cartTotal >= freeThreshold) {
    return 0;
  }

  return deliveryCharge;
}

function formatMoney(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-IN") : "0";
}

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams();

  // This can be normal slug: ambica
  // Or custom domain from middleware: shop.ambica.com
  const storeSlug = params?.storeSlug;

  const { cartItems, cartTotal, storeInfo } = useCart();

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];
  const safeCartTotal = Number(cartTotal || 0);

  const [storeDoc, setStoreDoc] = useState(null);
  const [privateStore, setPrivateStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCheckoutStore() {
      try {
        if (!storeSlug) {
          if (isMounted) {
            setStoreDoc(null);
            setPrivateStore(null);
            setLoading(false);
          }
          return;
        }

        setLoading(true);

        const storeData = await getStoreBySlugOrDomain(storeSlug);

        if (!isMounted) return;

        if (!storeData) {
          setStoreDoc(null);
          setPrivateStore(null);
          setLoading(false);
          return;
        }

        setStoreDoc(storeData);

        try {
          const response = await fetch(
            `/api/get-store-private?storeId=${encodeURIComponent(storeData.id)}`,
            { cache: "no-store" }
          );

          if (!response.ok) {
            throw new Error(
              `Failed to fetch private store settings: ${response.status}`
            );
          }

          const json = await response.json();

          if (isMounted) {
            setPrivateStore(json?.data || null);
          }
        } catch (error) {
          console.error("Error loading private store settings:", error);

          if (isMounted) {
            setPrivateStore(null);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error loading checkout store:", error);

        if (isMounted) {
          setStoreDoc(null);
          setPrivateStore(null);
          setLoading(false);
        }
      }
    }

    loadCheckoutStore();

    return () => {
      isMounted = false;
    };
  }, [storeSlug]);

  const storeTimings = privateStore?.storeTimings || {};
  const deliverySettings = privateStore?.deliverySettings || {};
  const orderSettings = privateStore?.orderSettings || {};
  const themeColor = privateStore?.branding?.themeColor || "#128c7e";

  const isStoreClosed =
    storeDoc?.isActive === false ||
    storeTimings?.acceptOrdersNow === false ||
    storeTimings?.vacationMode === true ||
    storeTimings?.temporaryClosure === true;

  const minOrderAmount = Number(orderSettings?.minimumOrderAmount || 0);
  const maxOrderQty = Number(orderSettings?.maximumOrderQuantity || 0);

  const totalQty = useMemo(() => {
    return safeCartItems.reduce(
      (sum, item) => sum + Number(item?.quantity || 0),
      0
    );
  }, [safeCartItems]);

  const deliveryCharge = useMemo(() => {
    return calculateDelivery(safeCartTotal, deliverySettings);
  }, [safeCartTotal, deliverySettings]);

  const finalTotal = useMemo(() => {
    return safeCartTotal + Number(deliveryCharge || 0);
  }, [safeCartTotal, deliveryCharge]);

  const cartBelongsToThisStore = useMemo(() => {
    if (!storeDoc?.id) return true;
    if (!safeCartItems.length) return true;

    return safeCartItems.every(
      (item) => String(item?.storeId || "") === String(storeDoc.id)
    );
  }, [safeCartItems, storeDoc]);

  const currentStoreMatchesCart = useMemo(() => {
    if (!storeInfo) return true;
    if (!storeDoc?.id) return true;

    // Best check: compare storeId
    if (storeInfo?.storeId) {
      return String(storeInfo.storeId) === String(storeDoc.id);
    }

    // Fallback check: compare saved cart slug with actual store slug
    if (storeInfo?.slug) {
      return (
        String(storeInfo.slug) === String(storeDoc.slug) ||
        String(storeInfo.slug) === String(storeSlug)
      );
    }

    return true;
  }, [storeInfo, storeDoc, storeSlug]);

  const continueShoppingPath = storeSlug ? `/${storeSlug}` : "/";

  if (loading) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
        <div className="p-6">Loading checkout...</div>
      </>
    );
  }

  if (!storeSlug) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
        <div className="p-6 text-red-500">Store slug not found.</div>
      </>
    );
  }

  if (!storeDoc) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
        <div className="p-6 text-red-500">Store not found.</div>
      </>
    );
  }

  if (!currentStoreMatchesCart) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />

        <div className="min-h-screen bg-[#f0f2f5] p-6">
          <div className="mx-auto max-w-xl rounded-[24px] bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Cart belongs to another store
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Please go back to the correct store and add items again.
            </p>
            <button
              onClick={() => router.push("/cart")}
              className="mt-5 rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: themeColor }}
            >
              Go to Cart
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!cartBelongsToThisStore) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />

        <div className="min-h-screen bg-[#f0f2f5] p-6">
          <div className="mx-auto max-w-xl rounded-[24px] bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Invalid cart items for this store
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Some items in your cart do not belong to this store.
            </p>
            <button
              onClick={() => router.push("/cart")}
              className="mt-5 rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: themeColor }}
            >
              Review Cart
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!safeCartItems.length) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />

        <div className="min-h-screen bg-[#f0f2f5] p-6">
          <div className="mx-auto max-w-xl rounded-[24px] bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-gray-900">
              Your cart is empty
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Add products to continue checkout.
            </p>

            <button
              onClick={() => router.push(continueShoppingPath)}
              className="mt-5 rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: themeColor }}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </>
    );
  }

  if (isStoreClosed) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />

        <div className="min-h-screen bg-[#f0f2f5] p-6">
          <div className="mx-auto max-w-xl rounded-[24px] bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Store is not accepting orders right now
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Please try again later.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (minOrderAmount > 0 && safeCartTotal < minOrderAmount) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />

        <div className="min-h-screen bg-[#f0f2f5] p-6">
          <div className="mx-auto max-w-xl rounded-[24px] bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Minimum order amount not reached
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Minimum order amount is ₹{formatMoney(minOrderAmount)}.
            </p>
            <button
              onClick={() => router.push(continueShoppingPath)}
              className="mt-5 rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: themeColor }}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </>
    );
  }

  if (maxOrderQty > 0 && totalQty > maxOrderQty) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />

        <div className="min-h-screen bg-[#f0f2f5] p-6">
          <div className="mx-auto max-w-xl rounded-[24px] bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Maximum order quantity exceeded
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              You can order up to {maxOrderQty} item
              {maxOrderQty > 1 ? "s" : ""} only.
            </p>
            <button
              onClick={() => router.push("/cart")}
              className="mt-5 rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: themeColor }}
            >
              Review Cart
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />

      <div className="min-h-screen bg-[#f0f2f5]">
        <div
          className="sticky top-0 z-40 px-4 py-3 text-white shadow-sm"
          style={{ backgroundColor: themeColor }}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium"
            >
              ← Back
            </button>

            <h1 className="text-[17px] font-bold">Checkout</h1>

            <div className="w-[64px]" />
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[24px] bg-white p-4 shadow-sm md:p-6">
              <h2 className="text-[20px] font-bold text-gray-900">
                Delivery Details
              </h2>

              <CheckoutForm
                storeSlug={storeDoc?.slug || storeSlug}
                storeId={storeDoc.id}
                storeName={storeDoc.storeName}
                deliveryCharge={deliveryCharge}
                finalTotal={finalTotal}
                privateStore={privateStore}
                storeDoc={storeDoc}
              />
            </div>

            <div className="h-fit rounded-[24px] border bg-white p-5 shadow-sm">
              <h2 className="text-[20px] font-bold text-gray-900">
                Order Summary
              </h2>

              <div className="mt-5 space-y-4">
                {safeCartItems.map((item) => {
                  const itemQty = Number(item?.quantity || 0);
                  const itemPrice = Number(item?.price || 0);
                  const itemTotal = itemQty * itemPrice;

                  return (
                    <div key={item.id} className="flex justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">
                          {item.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {itemQty} × ₹{formatMoney(itemPrice)}
                        </p>
                      </div>

                      <p className="shrink-0 font-semibold text-gray-900">
                        ₹{formatMoney(itemTotal)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl bg-gray-50 p-4">
                <div className="flex justify-between text-sm">
                  <span>Items Total</span>
                  <span>₹{formatMoney(safeCartTotal)}</span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span>Delivery</span>
                  <span>
                    {deliveryCharge === 0
                      ? "Free"
                      : `₹${formatMoney(deliveryCharge)}`}
                  </span>
                </div>

                <div className="mt-3 flex justify-between font-bold">
                  <span>Total</span>
                  <span>₹{formatMoney(finalTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}