"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useCart from "@/hooks/useCart";
import { getStoreBySlug } from "@/lib/firestore";

function getSafeColor(value, fallback) {
  const str = String(value || "").trim();
  return str || fallback;
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

function normalizePhoneNumber(raw) {
  let clean = String(raw || "").replace(/\D/g, "");

  if (!clean) return "";

  if (clean.length === 10) {
    clean = `91${clean}`;
  }

  if (clean.length === 11 && clean.startsWith("0")) {
    clean = `91${clean.slice(1)}`;
  }

  return clean;
}

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const { storeInfo, clearCart } = useCart();

  const [storeData, setStoreData] = useState(null);
  const [privateStore, setPrivateStore] = useState(null);

  const orderId = String(searchParams?.get("orderId") || "").trim();
  const searchStoreSlug = String(searchParams?.get("storeSlug") || "").trim();
  const storeSlug = searchStoreSlug || String(storeInfo?.slug || "").trim();

  useEffect(() => {
    let isMounted = true;

    async function loadStore() {
      try {
        if (!storeSlug) {
          if (isMounted) setStoreData(null);
          return;
        }

        const data = await getStoreBySlug(storeSlug);

        if (isMounted) {
          setStoreData(data || null);
        }
      } catch {
        if (isMounted) {
          setStoreData(null);
        }
      }
    }

    loadStore();

    return () => {
      isMounted = false;
    };
  }, [storeSlug]);

  useEffect(() => {
    let active = true;

    async function loadPrivateStore() {
      try {
        if (!storeData?.id) {
          if (active) setPrivateStore(null);
          return;
        }

        const res = await fetch(
          `/api/get-store-private?storeId=${encodeURIComponent(storeData.id)}`,
          { cache: "no-store" }
        );

        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        if (!active) return;

        if (res.ok && data?.success) {
          setPrivateStore(data.data || null);
        } else {
          setPrivateStore(null);
        }
      } catch {
        if (active) {
          setPrivateStore(null);
        }
      }
    }

    loadPrivateStore();

    return () => {
      active = false;
    };
  }, [storeData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      clearCart?.();
    }, 800);

    return () => clearTimeout(timer);
  }, [clearCart]);

  const branding = useMemo(() => {
    return {
      ...(storeData?.branding || {}),
      ...(privateStore?.branding || {}),
      ...(storeInfo?.branding || {}),
    };
  }, [storeData, privateStore, storeInfo]);

  const appearance = useMemo(() => {
    return {
      ...(storeInfo?.appearance || {}),
      ...(privateStore?.appearance || {}),
      ...(storeData?.appearance || {}),
    };
  }, [storeInfo, privateStore, storeData]);

  const themeColor = getSafeColor(branding?.themeColor, "#128c7e");

  const buttonColor = getSafeColor(
    branding?.buttonColor || branding?.accentColor,
    themeColor
  );

  const pageBg = getSafeColor(appearance?.pageBackground, "#f5f7fb");
  const cardBg = getSafeColor(appearance?.cardBackground, "#ffffff");
  const textColor = getSafeColor(appearance?.textColor, "#111827");
  const mutedTextColor = getSafeColor(appearance?.mutedTextColor, "#6b7280");

  const borderColor = getSafeColor(
    appearance?.borderColor,
    "rgba(15, 23, 42, 0.08)"
  );

  const buttonTextColor = getContrastTextColor(buttonColor);

  const businessPhone = useMemo(() => {
    const raw = privateStore?.phone || storeData?.phone || storeInfo?.phone || "";
    return normalizePhoneNumber(raw);
  }, [privateStore, storeData, storeInfo]);

  const whatsappMessage = useMemo(() => {
    const message = `
Hi, I would like to confirm my order.

🧾 Order ID: ${orderId || "N/A"}
🏪 Store: ${storeData?.storeName || storeInfo?.storeName || "Store"}

Please confirm and proceed with my order.
    `.trim();

    return encodeURIComponent(message);
  }, [orderId, storeData, storeInfo]);

  const whatsappUrl = useMemo(() => {
    if (!businessPhone) return "";
    return `https://wa.me/${businessPhone}?text=${whatsappMessage}`;
  }, [businessPhone, whatsappMessage]);

  return (
    <main
      className="min-h-screen px-4 py-10"
      style={{ backgroundColor: pageBg }}
    >
      <div className="mx-auto max-w-md">
        <div
          className="rounded-[28px] p-8 text-center"
          style={{
            backgroundColor: cardBg,
            border: `1px solid ${borderColor}`,
            boxShadow: `0 10px 30px ${hexToRgba(themeColor, 0.08)}`,
          }}
        >
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl"
            style={{
              backgroundColor: hexToRgba(themeColor, 0.1),
              color: themeColor,
            }}
          >
            ✅
          </div>

          <h1 className="mt-5 text-2xl font-bold" style={{ color: textColor }}>
            Payment Successful
          </h1>

          <p
            className="mt-2 text-sm leading-6"
            style={{ color: mutedTextColor }}
          >
            Your payment was successful. Please confirm your order on WhatsApp
            to proceed.
          </p>

          {orderId ? (
            <div
              className="mt-5 rounded-2xl px-4 py-4"
              style={{
                backgroundColor: hexToRgba(themeColor, 0.05),
                border: `1px solid ${borderColor}`,
              }}
            >
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: mutedTextColor }}
              >
                Order ID
              </p>

              <p
                className="mt-1 break-all text-sm font-bold"
                style={{ color: themeColor }}
              >
                {orderId}
              </p>
            </div>
          ) : null}

          {businessPhone ? (
            <div className="mt-6">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-6 py-3 text-center text-sm font-bold transition active:scale-[0.98]"
                style={{
                  backgroundColor: "#25D366",
                  color: "#ffffff",
                  borderRadius: "18px",
                  boxShadow: "0 12px 24px rgba(37, 211, 102, 0.25)",
                }}
              >
                Send WhatsApp to Confirm Order →
              </a>
            </div>
          ) : (
            <div
              className="mt-6 rounded-2xl px-4 py-3 text-sm"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.06)",
                border: "1px solid rgba(239, 68, 68, 0.18)",
                color: "#b91c1c",
              }}
            >
              Business WhatsApp number is not available in store settings.
            </div>
          )}

          <div className="mt-3">
            <Link
              href="/"
              className="block w-full px-6 py-3 text-sm font-bold transition active:scale-[0.98]"
              style={{
                backgroundColor: buttonColor,
                color: buttonTextColor,
                borderRadius: "18px",
                boxShadow: `0 12px 24px ${hexToRgba(buttonColor, 0.2)}`,
              }}
            >
              Back to Store
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CustomDomainSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb]">
          <p className="text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <SuccessPageContent />
    </Suspense>
  );
}