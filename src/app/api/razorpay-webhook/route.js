import crypto from "crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toString(value) {
  return String(value ?? "").trim();
}

function computeWebhookSignature(rawBody, secret) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function safeCompareSignatures(a, b) {
  const left = Buffer.from(toString(a), "utf8");
  const right = Buffer.from(toString(b), "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export async function POST(request) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: "Database not initialized" },
        { status: 500 }
      );
    }

    const signature = toString(request.headers.get("x-razorpay-signature"));
    const eventId = toString(request.headers.get("x-razorpay-event-id"));
    const rawBody = await request.text();

    if (!signature) {
      return NextResponse.json(
        { success: false, error: "Missing webhook signature" },
        { status: 400 }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "Missing webhook event id" },
        { status: 400 }
      );
    }

    if (!rawBody) {
      return NextResponse.json(
        { success: false, error: "Empty webhook body" },
        { status: 400 }
      );
    }

    const payload = safeJsonParse(rawBody);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const eventType = toString(payload?.event);
    const paymentEntity = payload?.payload?.payment?.entity || null;
    const orderEntity = payload?.payload?.order?.entity || null;

    const notes = paymentEntity?.notes || orderEntity?.notes || {};
    const appOrderId = toString(notes?.appOrderId);
    const storeId = toString(notes?.storeId);

    if (!storeId || !appOrderId) {
      return NextResponse.json(
        { success: false, error: "Missing storeId/appOrderId in webhook notes" },
        { status: 400 }
      );
    }

    const processedRef = adminDb.collection("webhook_events").doc(eventId);
    const processedSnap = await processedRef.get();

    if (processedSnap.exists) {
      return NextResponse.json({
        success: true,
        duplicate: true,
      });
    }

    const privateSnap = await adminDb.collection("store_private").doc(storeId).get();

    if (!privateSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Private config not found" },
        { status: 404 }
      );
    }

    const privateData = privateSnap.data() || {};
    const webhookSecret = toString(privateData?.razorpayWebhookSecret);

    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: "Webhook secret missing for store" },
        { status: 400 }
      );
    }

    const expectedSignature = computeWebhookSignature(rawBody, webhookSecret);

    if (!safeCompareSignatures(expectedSignature, signature)) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    const orderRef = adminDb.collection("orders").doc(appOrderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json(
        { success: false, error: "App order not found" },
        { status: 404 }
      );
    }

    const existingOrder = orderSnap.data() || {};

    if (toString(existingOrder?.storeId) !== storeId) {
      return NextResponse.json(
        { success: false, error: "Webhook store mismatch" },
        { status: 400 }
      );
    }

    const update = {
      updatedAt: FieldValue.serverTimestamp(),
      webhookEventType: eventType,
      webhookEventId: eventId,
    };

    if (eventType === "order.paid" || eventType === "payment.captured") {
      Object.assign(update, {
        paymentMethod: "Razorpay",
        paymentStatus: "paid",
        orderStatus:
          toString(existingOrder?.orderStatus) === "placed"
            ? "placed"
            : "new",
        razorpayOrderId:
          toString(paymentEntity?.order_id) ||
          toString(orderEntity?.id) ||
          toString(existingOrder?.razorpayOrderId),
        razorpayPaymentId:
          toString(paymentEntity?.id) ||
          toString(existingOrder?.razorpayPaymentId),
      });
    }

    if (eventType === "payment.failed") {
      Object.assign(update, {
        paymentMethod: "Razorpay",
        paymentStatus: "failed",
        razorpayOrderId:
          toString(paymentEntity?.order_id) ||
          toString(existingOrder?.razorpayOrderId),
        razorpayPaymentId:
          toString(paymentEntity?.id) ||
          toString(existingOrder?.razorpayPaymentId),
      });
    }

    const batch = adminDb.batch();

    batch.update(orderRef, update);

    batch.set(processedRef, {
      createdAt: FieldValue.serverTimestamp(),
      eventId,
      eventType,
      storeId,
      appOrderId,
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      processed: true,
      eventType,
    });
  } catch (error) {
    console.error("Razorpay webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Webhook processing failed",
      },
      { status: 500 }
    );
  }
}