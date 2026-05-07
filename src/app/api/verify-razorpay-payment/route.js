import { NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { placeOrderServer } from "@/lib/placeOrderServer";

export const runtime = "nodejs";

/* ---------------- HELPERS ---------------- */

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toString(value) {
  return String(value ?? "").trim();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePincode(value) {
  return String(value || "").replace(/\D/g, "");
}

/* ---------------- MAIN ---------------- */

export async function POST(request) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: "DB not initialized" },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      storeId,
      storeSlug = "",
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      customer,
      items,
      notes = "",
      subtotal = 0,
      deliveryCharge = 0,
      total = 0,
      totalAmount = 0,
    } = body || {};

    const safeStoreId = toString(storeId);
    const safeSlug = toString(storeSlug);
    const appOrderId = toString(orderId);

    if (!safeStoreId) {
      return NextResponse.json(
        { success: false, error: "storeId is required" },
        { status: 400 }
      );
    }

    if (!appOrderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required" },
        { status: 400 }
      );
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { success: false, error: "Missing Razorpay payment details" },
        { status: 400 }
      );
    }

    if (!customer || typeof customer !== "object") {
      return NextResponse.json(
        { success: false, error: "Customer details are required" },
        { status: 400 }
      );
    }

    const cleanCustomer = {
      name: toString(customer.name),
      phone: normalizePhone(customer.phone),
      email: toString(customer.email),
      address: toString(customer.address),
      city: toString(customer.city),
      pincode: normalizePincode(customer.pincode),
    };

    if (!cleanCustomer.name) {
      return NextResponse.json(
        { success: false, error: "Customer name is required" },
        { status: 400 }
      );
    }

    if (!cleanCustomer.phone || cleanCustomer.phone.length < 10) {
      return NextResponse.json(
        { success: false, error: "Customer phone is required" },
        { status: 400 }
      );
    }

    if (!cleanCustomer.address) {
      return NextResponse.json(
        { success: false, error: "Customer address is required" },
        { status: 400 }
      );
    }

    if (!cleanCustomer.city) {
      return NextResponse.json(
        { success: false, error: "Customer city is required" },
        { status: 400 }
      );
    }

    if (!cleanCustomer.pincode || cleanCustomer.pincode.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Customer pincode is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order items are required" },
        { status: 400 }
      );
    }

    const cleanedItems = items.map((item) => ({
      id: toString(item?.id),
      quantity: toNumber(item?.quantity, 0),
    }));

    const invalidItem = cleanedItems.find(
      (item) => !item.id || item.quantity <= 0
    );

    if (invalidItem) {
      return NextResponse.json(
        { success: false, error: "Invalid items data" },
        { status: 400 }
      );
    }

    const [storeSnap, privateSnap] = await Promise.all([
      adminDb.collection("stores").doc(safeStoreId).get(),
      adminDb.collection("store_private").doc(safeStoreId).get(),
    ]);

    if (!storeSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Store not found" },
        { status: 404 }
      );
    }

    if (!privateSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Private store config not found" },
        { status: 404 }
      );
    }

    const storeData = storeSnap.data() || {};
    const privateData = privateSnap.data() || {};

    if (safeSlug && toString(storeData?.slug) !== safeSlug) {
      return NextResponse.json(
        { success: false, error: "Store slug mismatch" },
        { status: 400 }
      );
    }

    if (storeData?.isActive === false) {
      return NextResponse.json(
        { success: false, error: "Store is inactive" },
        { status: 400 }
      );
    }

    const timings = privateData?.storeTimings || {};

    if (
      timings?.acceptOrdersNow === false ||
      timings?.vacationMode === true ||
      timings?.temporaryClosure === true
    ) {
      return NextResponse.json(
        { success: false, error: "Store not accepting orders" },
        { status: 400 }
      );
    }

    if (storeData?.paymentConfig?.razorpayEnabled !== true) {
      return NextResponse.json(
        { success: false, error: "Online payment disabled" },
        { status: 400 }
      );
    }

    const secret = toString(privateData?.razorpayKeySecret);

    if (!secret) {
      return NextResponse.json(
        { success: false, error: "Missing Razorpay secret" },
        { status: 500 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return NextResponse.json(
        { success: false, error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    const subtotalNum = toNumber(subtotal);
    const reqDelivery = toNumber(deliveryCharge);
    const reqTotal = toNumber(totalAmount || total);

    const orderSettings = privateData?.orderSettings || {};
    const deliverySettings = privateData?.deliverySettings || {};

    const minOrder = toNumber(orderSettings?.minimumOrderAmount);
    if (minOrder > 0 && subtotalNum > 0 && subtotalNum < minOrder) {
      return NextResponse.json(
        { success: false, error: `Minimum order ₹${minOrder}` },
        { status: 400 }
      );
    }

    if (deliverySettings?.deliveryEnabled === false) {
      return NextResponse.json(
        { success: false, error: "Delivery not available" },
        { status: 400 }
      );
    }

    const deliveryConfig = toNumber(deliverySettings?.deliveryCharge);
    const freeThreshold = toNumber(deliverySettings?.freeDeliveryThreshold);

    const finalDelivery =
      freeThreshold > 0 && subtotalNum >= freeThreshold ? 0 : deliveryConfig;

    const finalTotal =
      subtotalNum > 0 ? subtotalNum + finalDelivery : reqTotal;

    if (subtotalNum > 0) {
      if (reqDelivery !== finalDelivery) {
        return NextResponse.json(
          { success: false, error: "Delivery mismatch" },
          { status: 400 }
        );
      }

      if (reqTotal !== finalTotal) {
        return NextResponse.json(
          { success: false, error: "Total mismatch" },
          { status: 400 }
        );
      }
    }

    const maxQty = toNumber(orderSettings?.maximumOrderQuantity);
    const totalQty = cleanedItems.reduce(
      (sum, item) => sum + toNumber(item.quantity),
      0
    );

    if (maxQty > 0 && totalQty > maxQty) {
      return NextResponse.json(
        { success: false, error: `Maximum ${maxQty} items allowed` },
        { status: 400 }
      );
    }

    const result = await placeOrderServer({
      orderId: appOrderId,
      storeId: safeStoreId,
      storeSlug: safeSlug || toString(storeData?.slug),
      customer: cleanCustomer,
      items: cleanedItems,
      paymentMethod: "online",
      notes: toString(notes),
      subtotal: subtotalNum,
      deliveryCharge: finalDelivery,
      totalAmount: finalTotal,
      paymentStatus: "paid",
      status: "placed",
      orderIdPrefix:
        toString(orderSettings?.orderIdPrefix) || "QRT",
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    });

    let webhookTriggered = false;
    let webhookError = "";

    try {
      const origin = request.nextUrl.origin;

      const webhookRes = await fetch(`${origin}/api/order-status-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: result?.orderId || appOrderId,
        }),
      });

      webhookTriggered = webhookRes.ok;

      if (!webhookRes.ok) {
        let webhookJson = {};
        try {
          webhookJson = await webhookRes.json();
        } catch {
          webhookJson = {};
        }
        webhookError = toString(
          webhookJson?.error || "Webhook trigger failed"
        );
      }
    } catch (err) {
      webhookTriggered = false;
      webhookError = toString(err?.message || "Webhook trigger failed");
      console.error("Webhook trigger error:", err);
    }

    return NextResponse.json({
      success: true,
      orderId: result?.orderId || appOrderId,
      webhookTriggered,
      webhookError,
      message: "Payment verified and order placed successfully",
    });
  } catch (error) {
    console.error("verify-razorpay-payment error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}