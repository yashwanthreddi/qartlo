"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useCart from "@/hooks/useCart";

export default function CheckoutForm({
  storeSlug,
  storeId,
  storeName,
  deliveryCharge = 0,
  finalTotal = 0,
  privateStore,
  storeDoc,
}) {
  const router = useRouter();
  const { cartItems, cartTotal, clearCart } = useCart();

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];
  const safeCartTotal = Number(cartTotal || 0);
  const safeDeliveryCharge = Number(deliveryCharge || 0);
  const safeFinalTotal = Number(finalTotal || 0);

  const orderSettings = privateStore?.orderSettings || {};
  const paymentMethods = privateStore?.paymentMethods || {};
  const storeTimings = privateStore?.storeTimings || {};
  const branding = privateStore?.branding || {};
  const paymentConfig = storeDoc?.paymentConfig || {};

  const codEnabled = paymentMethods?.codEnabled !== false;
  const razorpayEnabled =
    paymentConfig?.razorpayEnabled === true && !!paymentConfig?.razorpayKeyId;

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    pincode: "",
    notes: "",
    paymentMethod: codEnabled ? "cod" : razorpayEnabled ? "online" : "",
  });

  const [loading, setLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const totalItems = useMemo(() => {
    return safeCartItems.reduce(
      (sum, item) => sum + Number(item?.quantity || 0),
      0,
    );
  }, [safeCartItems]);

  const themeColor = branding?.themeColor || "#128c7e";
  const buttonColor =
    branding?.buttonColor || branding?.accentColor || "#128c7e";

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
  const normalizePincode = (value) => String(value || "").replace(/\D/g, "");

  const validateForm = () => {
    const phoneDigits = normalizePhone(form.phone);
    const pincodeDigits = normalizePincode(form.pincode);

    if (!form.customerName.trim()) {
      alert("Enter name");
      return false;
    }

    if (!phoneDigits) {
      alert("Enter phone");
      return false;
    }

    if (phoneDigits.length < 10) {
      alert("Enter valid phone number");
      return false;
    }

    if (!form.address.trim()) {
      alert("Enter address");
      return false;
    }

    if (!form.city.trim()) {
      alert("Enter city");
      return false;
    }

    if (!pincodeDigits) {
      alert("Enter pincode");
      return false;
    }

    if (pincodeDigits.length !== 6) {
      alert("Enter valid pincode");
      return false;
    }

    if (!form.paymentMethod) {
      alert("Select payment method");
      return false;
    }

    if (
      storeTimings?.acceptOrdersNow === false ||
      storeTimings?.vacationMode === true ||
      storeTimings?.temporaryClosure === true
    ) {
      alert("Store not accepting orders");
      return false;
    }

    const minOrder = Number(orderSettings?.minimumOrderAmount || 0);
    if (minOrder > 0 && safeCartTotal < minOrder) {
      alert(`Minimum order ₹${minOrder}`);
      return false;
    }

    const maxQty = Number(orderSettings?.maximumOrderQuantity || 0);
    if (maxQty > 0 && totalItems > maxQty) {
      alert(`Max ${maxQty} items allowed`);
      return false;
    }

    if (form.paymentMethod === "cod") {
      if (!codEnabled) {
        alert("COD not available");
        return false;
      }

      const codLimit = Number(orderSettings?.codLimitAmount || 0);
      if (codLimit > 0 && safeFinalTotal > codLimit) {
        alert(`COD allowed only below ₹${codLimit}`);
        return false;
      }
    }

    if (form.paymentMethod === "online" && !razorpayEnabled) {
      alert("Online payment not available");
      return false;
    }

    return true;
  };

  const buildPayload = () => ({
    storeId,
    storeSlug,
    customer: {
      name: form.customerName.trim(),
      phone: normalizePhone(form.phone),
      email: form.email.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      pincode: normalizePincode(form.pincode),
    },
    items: safeCartItems.map((item) => ({
      id: item?.id,
      quantity: Number(item?.quantity || 0),
    })),
    paymentMethod: form.paymentMethod,
    notes: orderSettings?.enableOrderNotes ? form.notes.trim() : "",
    subtotal: safeCartTotal,
    deliveryCharge: safeDeliveryCharge,
    totalAmount: safeFinalTotal,
  });

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (loading || verifyingPayment) return;
    if (!validateForm()) return;

    try {
      setLoading(true);

      const payload = buildPayload();

      if (form.paymentMethod === "cod") {
        const res = await fetch("/api/place-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        if (!res.ok) {
          throw new Error(data?.error || "Failed to place order");
        }

        clearCart();
        router.push(
          `/success?orderId=${encodeURIComponent(
            data.orderId || "",
          )}&storeSlug=${encodeURIComponent(storeSlug)}`,
        );
        return;
      }

      const res = await fetch("/api/create-razorpay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          amount: safeFinalTotal,
          subtotal: safeCartTotal,
          deliveryCharge: safeDeliveryCharge,
          totalAmount: safeFinalTotal,
        }),
      });

      let razorpayData = {};
      try {
        razorpayData = await res.json();
      } catch {
        razorpayData = {};
      }

      if (!res.ok) {
        throw new Error(
          razorpayData?.error || "Failed to create payment order",
        );
      }

      const appOrderId = razorpayData?.appOrderId;
      if (!appOrderId) {
        throw new Error("Order ID generation failed");
      }

      if (typeof window === "undefined" || !window.Razorpay) {
        throw new Error("Razorpay SDK not loaded");
      }

      const rzp = new window.Razorpay({
        key: razorpayData.keyId,
        amount: razorpayData.amount,
        order_id: razorpayData.orderId,
        name: storeName || "Store",
        description: `Order from ${storeName || "Store"}`,
        handler: async (response) => {
          try {
            setVerifyingPayment(true);

            const verify = await fetch("/api/verify-razorpay-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...payload,
                orderId: appOrderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            let verifyData = {};
            try {
              verifyData = await verify.json();
            } catch {
              verifyData = {};
            }

            if (!verify.ok) {
              throw new Error(
                verifyData?.error || "Payment verification failed",
              );
            }

            clearCart();
            router.push(
              `/success?orderId=${encodeURIComponent(
                verifyData.orderId || appOrderId,
              )}&storeSlug=${encodeURIComponent(storeSlug)}`,
            );
          } catch (err) {
            console.error("Razorpay verify error:", err);
            alert(err?.message || "Payment verification failed");
          } finally {
            setVerifyingPayment(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        theme: { color: themeColor },
        prefill: {
          name: form.customerName.trim(),
          email: form.email.trim(),
          contact: normalizePhone(form.phone),
        },
      });

      rzp.open();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Order failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#128c7e] focus:ring-4 focus:ring-[#128c7e]/10";

  const paymentCardClass = (active) =>
    `w-full rounded-2xl border px-4 py-4 text-left transition ${
      active
        ? "border-transparent text-white shadow-sm"
        : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
    }`;

  return (
    <form onSubmit={handlePlaceOrder} className="space-y-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-gray-900">
          Contact Details
        </h3>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            placeholder="Name"
            value={form.customerName}
            onChange={(e) => handleChange("customerName", e.target.value)}
            className={inputClass}
          />

          <input
            type="tel"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="mt-3">
          <input
            type="email"
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="mt-3">
          <input
            type="text"
            placeholder="Address"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            type="text"
            placeholder="City"
            value={form.city}
            onChange={(e) => handleChange("city", e.target.value)}
            className={inputClass}
          />

          <input
            type="text"
            placeholder="Pincode"
            value={form.pincode}
            onChange={(e) => handleChange("pincode", e.target.value)}
            className={inputClass}
          />
        </div>

        {orderSettings?.enableOrderNotes ? (
          <div className="mt-3">
            <textarea
              rows={4}
              placeholder="Add notes (optional)"
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-gray-900">Payment Method</h3>

        <div className="grid gap-3 md:grid-cols-2">
          {codEnabled ? (
            <button
              type="button"
              onClick={() => handleChange("paymentMethod", "cod")}
              className={paymentCardClass(form.paymentMethod === "cod")}
              style={
                form.paymentMethod === "cod"
                  ? { backgroundColor: buttonColor }
                  : undefined
              }
            >
              <div className="font-semibold">Cash on Delivery</div>
              <div
                className={`mt-1 text-sm ${
                  form.paymentMethod === "cod"
                    ? "text-white/90"
                    : "text-gray-500"
                }`}
              >
                Pay when the order arrives
              </div>
            </button>
          ) : null}

          {razorpayEnabled ? (
            <button
              type="button"
              onClick={() => handleChange("paymentMethod", "online")}
              className={paymentCardClass(form.paymentMethod === "online")}
              style={
                form.paymentMethod === "online"
                  ? { backgroundColor: buttonColor }
                  : undefined
              }
            >
              <div className="font-semibold">Pay Online</div>
              <div
                className={`mt-1 text-sm ${
                  form.paymentMethod === "online"
                    ? "text-white/90"
                    : "text-gray-500"
                }`}
              >
                UPI, cards, wallets, net banking
              </div>
            </button>
          ) : null}
        </div>

        {!codEnabled && !razorpayEnabled ? (
          <p className="mt-3 text-sm text-red-600">
            No payment methods are currently available for this store.
          </p>
        ) : null}

        {form.paymentMethod === "cod" &&
        Number(orderSettings?.codLimitAmount || 0) > 0 ? (
          <p className="mt-3 text-sm text-amber-700">
            COD available up to ₹
            {Number(orderSettings.codLimitAmount).toLocaleString("en-IN")}
          </p>
        ) : null}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-gray-900">
          Payment Summary
        </h3>

        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-center justify-between">
            <span>Items</span>
            <span>₹{safeCartTotal.toLocaleString("en-IN")}</span>
          </div>

          <div className="flex items-center justify-between">
            <span>Delivery</span>
            <span>
              {safeDeliveryCharge === 0
                ? "Free"
                : `₹${safeDeliveryCharge.toLocaleString("en-IN")}`}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900">
            <span>Total</span>
            <span>₹{safeFinalTotal.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={
          loading || verifyingPayment || (!codEnabled && !razorpayEnabled)
        }
        className="w-full rounded-2xl px-5 py-4 text-base font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: buttonColor }}
      >
        {verifyingPayment
          ? "Verifying Payment..."
          : loading
            ? form.paymentMethod === "online"
              ? "Processing Payment..."
              : "Placing Order..."
            : form.paymentMethod === "online"
              ? `Pay ₹${safeFinalTotal.toLocaleString("en-IN")}`
              : "Place Order"}
      </button>
    </form>
  );
}
