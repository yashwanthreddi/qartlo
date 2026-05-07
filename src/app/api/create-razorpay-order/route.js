import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function generateAppOrderId() {
  return `ORD_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export async function POST(request) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: "Database not initialized" },
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
      amount,
      subtotal = 0,
      deliveryCharge = 0,
      totalAmount = 0,
      notes = {},
      customer = {},
      items = [],
      deliveryAddress = {},
      paymentMethod = "Razorpay",
    } = body || {};

    const safeStoreId = toString(storeId);

    if (!safeStoreId) {
      return NextResponse.json(
        { success: false, error: "storeId required" },
        { status: 400 }
      );
    }

    if (toNumber(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
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

    const store = storeSnap.data() || {};
    const privateData = privateSnap.exists ? privateSnap.data() || {} : {};

    const timings = privateData?.storeTimings || {};
    const orderSettings = privateData?.orderSettings || {};
    const deliverySettings = privateData?.deliverySettings || {};

    const razorpayEnabled = store?.paymentConfig?.razorpayEnabled === true;
    const razorpayKeyId = toString(store?.paymentConfig?.razorpayKeyId);
    const razorpayKeySecret = toString(privateData?.razorpayKeySecret);

    if (store?.isActive === false) {
      return NextResponse.json(
        { success: false, error: "Store inactive" },
        { status: 400 }
      );
    }

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

    if (!razorpayEnabled) {
      return NextResponse.json(
        { success: false, error: "Online payment disabled" },
        { status: 400 }
      );
    }

    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json(
        { success: false, error: "Razorpay config missing" },
        { status: 400 }
      );
    }

    const subtotalNum = toNumber(subtotal);
    const requestedDelivery = toNumber(deliveryCharge);
    const requestedTotal = toNumber(totalAmount);
    const requestedAmount = toNumber(amount);

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

    const deliveryChargeConfig = toNumber(deliverySettings?.deliveryCharge);
    const freeThreshold = toNumber(deliverySettings?.freeDeliveryThreshold);

    const finalDelivery =
      freeThreshold > 0 && subtotalNum >= freeThreshold
        ? 0
        : deliveryChargeConfig;

    const finalTotal =
      subtotalNum > 0 ? subtotalNum + finalDelivery : requestedAmount;

    if (finalTotal <= 0) {
      return NextResponse.json(
        { success: false, error: "Final amount must be greater than zero" },
        { status: 400 }
      );
    }

    if (subtotalNum > 0) {
      if (requestedDelivery !== finalDelivery) {
        return NextResponse.json(
          {
            success: false,
            error: "Delivery mismatch",
            expectedDelivery: finalDelivery,
          },
          { status: 400 }
        );
      }

      if (requestedTotal !== finalTotal) {
        return NextResponse.json(
          {
            success: false,
            error: "Total mismatch",
            expectedTotal: finalTotal,
          },
          { status: 400 }
        );
      }

      if (requestedAmount !== finalTotal) {
        return NextResponse.json(
          {
            success: false,
            error: "Amount mismatch",
            expectedAmount: finalTotal,
          },
          { status: 400 }
        );
      }
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const receipt = `rcpt_${Date.now()}`.slice(0, 40);
    const appOrderId = generateAppOrderId();

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalTotal * 100),
      currency: "INR",
      receipt,
      notes: {
        ...(notes && typeof notes === "object" ? notes : {}),
        storeId: safeStoreId,
        appOrderId,
      },
    });

    await adminDb.collection("orders").doc(appOrderId).set({
      appOrderId,
      storeId: safeStoreId,
      storeName: toString(store?.storeName),
      razorpayOrderId: toString(razorpayOrder?.id),
      receipt: toString(receipt),

      amount: finalTotal,
      subtotal: subtotalNum,
      deliveryCharge: finalDelivery,
      currency: "INR",

      paymentMethod: toString(paymentMethod || "Razorpay") || "Razorpay",
      paymentStatus: "pending",
      orderStatus: "new",

      customer:
        customer && typeof customer === "object" && !Array.isArray(customer)
          ? customer
          : {},

      items: Array.isArray(items) ? items : [],

      deliveryAddress:
        deliveryAddress &&
        typeof deliveryAddress === "object" &&
        !Array.isArray(deliveryAddress)
          ? deliveryAddress
          : {},

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      keyId: razorpayKeyId,
      orderId: razorpayOrder.id,
      appOrderId,
      amount: razorpayOrder.amount,
      finalAmount: finalTotal,
      deliveryCharge: finalDelivery,
      currency: "INR",
    });
  } catch (err) {
    console.error("create-razorpay-order error:", err);

    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Server error",
      },
      { status: 500 }
    );
  }
}