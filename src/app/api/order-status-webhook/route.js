import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

/* ---------------- HELPERS ---------------- */

function toString(value) {
  return String(value ?? "").trim();
}

function stripQuotes(value = "") {
  return toString(value).replace(/^['"]|['"]$/g, "");
}

function replacePlaceholders(input = "", payload = {}) {
  let output = String(input || "");

  Object.entries(payload || {}).forEach(([key, value]) => {
    const token = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    output = output.replace(token, String(value ?? ""));
  });

  return output;
}

function replacePlaceholdersInObject(obj = {}, payload = {}) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};

  const output = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === "string") {
      output[key] = replacePlaceholders(value, payload);
    } else {
      output[key] = value;
    }
  });

  return output;
}

function isLikelyUrl(value = "") {
  return /^https?:\/\//i.test(toString(value));
}

function parseCurl(curlCommand = "") {
  const result = {
    method: "POST",
    url: "",
    headers: {},
    body: "",
  };

  const normalized = String(curlCommand || "")
    .replace(/\\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const methodMatch = normalized.match(/(?:-X|--request)\s+([A-Z]+)/i);

  if (methodMatch?.[1]) {
    result.method = methodMatch[1].toUpperCase();
  }

  const urlMatch =
    normalized.match(/(?:--url|curl)\s+'([^']+)'/i) ||
    normalized.match(/(?:--url|curl)\s+"([^"]+)"/i);

  if (urlMatch?.[1]) {
    result.url = urlMatch[1];
  } else {
    const fallbackUrlMatch = normalized.match(/https?:\/\/[^\s'"]+/i);

    if (fallbackUrlMatch?.[0]) {
      result.url = fallbackUrlMatch[0];
    }
  }

  const headerRegex = /(?:-H|--header)\s+(['"])(.*?)\1/gi;
  let headerMatch;

  while ((headerMatch = headerRegex.exec(normalized)) !== null) {
    const headerLine = headerMatch[2];
    const separatorIndex = headerLine.indexOf(":");

    if (separatorIndex > -1) {
      const key = headerLine.slice(0, separatorIndex).trim();
      const value = headerLine.slice(separatorIndex + 1).trim();
      result.headers[key] = value;
    }
  }

  const dataMatch =
    normalized.match(/(?:--data-raw|--data|--data-binary|-d)\s+'([\s\S]*?)'/i) ||
    normalized.match(/(?:--data-raw|--data|--data-binary|-d)\s+"([\s\S]*?)"/i);

  if (dataMatch?.[1]) {
    result.body = dataMatch[1];
  }

  return result;
}

async function sendConfiguredWebhook(webhookValue = "", payload = {}) {
  const safeWebhookValue = toString(webhookValue);

  if (!safeWebhookValue) {
    return {
      attempted: false,
      ok: false,
      status: 0,
      message: "Order status has been updated, but the webhook is not configured for WhatsApp confirmation.",
      responseText: "",
    };
  }

  let method = "POST";
  let finalUrl = "";
  let headers = {};
  let finalBody = "";

  if (isLikelyUrl(safeWebhookValue)) {
    finalUrl = replacePlaceholders(stripQuotes(safeWebhookValue), payload);
    headers = {
      "Content-Type": "application/json",
    };
    finalBody = JSON.stringify(payload);
  } else if (safeWebhookValue.startsWith("curl")) {
    const parsed = parseCurl(safeWebhookValue);

    if (!parsed.url) {
      return {
        attempted: true,
        ok: false,
        status: 0,
        message: "Could not detect webhook URL",
        responseText: "",
      };
    }

    method = parsed.method || "POST";
    finalUrl = replacePlaceholders(stripQuotes(parsed.url), payload);
    headers = replacePlaceholdersInObject(parsed.headers || {}, payload);

    if (parsed.body) {
      finalBody = replacePlaceholders(parsed.body, payload);
    } else if (method !== "GET") {
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }

      finalBody = JSON.stringify(payload);
    }
  } else {
    return {
      attempted: true,
      ok: false,
      status: 0,
      message: "Webhook value must be a URL",
      responseText: "",
    };
  }

  const fetchOptions = {
    method,
    headers,
  };

  if (method !== "GET" && finalBody) {
    fetchOptions.body = finalBody;
  }

  const response = await fetch(finalUrl, fetchOptions);
  const responseText = await response.text();

  return {
    attempted: true,
    ok: response.ok,
    status: response.status,
    message: response.ok
      ? "Webhook sent successfully"
      : "Webhook endpoint returned non-success response",
    responseText,
    requestPreview: {
      method,
      url: finalUrl,
      headers,
      body: finalBody || "",
    },
  };
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

    const orderId = toString(body?.orderId);

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required" },
        { status: 400 }
      );
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    const order = orderSnap.data() || {};
    const storeId = toString(order?.storeId);

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "storeId missing in order" },
        { status: 400 }
      );
    }

    const storeSnap = await adminDb.collection("stores").doc(storeId).get();
    const storeData = storeSnap.exists ? storeSnap.data() || {} : {};

    const privateSnap = await adminDb
      .collection("store_private")
      .doc(storeId)
      .get();

    const privateData = privateSnap.exists ? privateSnap.data() || {} : {};

    const webhookValue =
      privateData?.webhooks?.wh2?.enabled !== false
        ? toString(privateData?.webhooks?.wh2?.curl)
        : "";

    const webhookPayload = {
      event: "order_status_updated",

      order_id: toString(order?.orderId || orderId),

      store_id: storeId,
      store_slug: toString(order?.storeSlug),
      store_name: toString(order?.storeName || storeData?.storeName),
      store_phone: toString(
        privateData?.storeProfile?.phone ||
          privateData?.storePhone ||
          storeData?.phone
      ),

      customer_name: toString(order?.customer?.name || order?.customerName),
      customer_phone: toString(order?.customer?.phone || order?.phone),
      customer_email: toString(order?.customer?.email),
      customer_address: toString(order?.customer?.address || order?.address),
      customer_city: toString(order?.customer?.city),
      customer_pincode: toString(order?.customer?.pincode),

      payment_method: toString(order?.paymentMethod),
      payment_status: toString(order?.paymentStatus),
      order_status: toString(order?.orderStatus || order?.status),

      subtotal: order?.subtotal ?? 0,
      delivery_charge: order?.deliveryCharge ?? 0,
      order_total: order?.totalAmount ?? 0,

      items: Array.isArray(order?.items) ? order.items : [],

      updated_at: new Date().toISOString(),
    };

    const webhookResult = await sendConfiguredWebhook(
      webhookValue,
      webhookPayload
    );

    return NextResponse.json({
      success: webhookResult.ok,
      webhookTriggered: webhookResult.ok,
      webhookStatus: webhookResult.status || 0,
      webhookError: webhookResult.ok ? "" : webhookResult.message,
      webhookResponseText: webhookResult.responseText || "",
      requestPreview: webhookResult.requestPreview || null,
    });
  } catch (error) {
    console.error("order-status-webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to trigger order status webhook",
      },
      { status: 500 }
    );
  }
}