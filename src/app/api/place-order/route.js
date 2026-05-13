import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

/* ---------------- HELPERS ---------------- */

function toString(value) {
  return String(value ?? "").trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePincode(value) {
  return String(value || "").replace(/\D/g, "");
}

function generateOrderId() {
  return `ORD_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function buildError(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
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
      message: "Webhook is not configured.",
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
      message: "Webhook value must be a URL or cURL command",
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
      return buildError("DB not initialized", 500);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return buildError("Invalid JSON body", 400);
    }

    const storeId = toString(body?.storeId);
    const storeSlug = toString(body?.storeSlug);
    const paymentMethod = toString(body?.paymentMethod).toLowerCase();

    const customer = {
      name: toString(body?.customer?.name),
      phone: normalizePhone(body?.customer?.phone),
      email: toString(body?.customer?.email),
      address: toString(body?.customer?.address),
      city: toString(body?.customer?.city),
      pincode: normalizePincode(body?.customer?.pincode),
    };

    const notes = toString(body?.notes);
    const requestedSubtotal = toNumber(body?.subtotal);
    const requestedDeliveryCharge = toNumber(body?.deliveryCharge);
    const requestedTotalAmount = toNumber(body?.totalAmount);

    const rawItems = Array.isArray(body?.items) ? body.items : [];

    const items = rawItems
      .map((item) => ({
        id: toString(item?.id),
        quantity: toNumber(item?.quantity),
      }))
      .filter((item) => item.id && item.quantity > 0);

    /* ---------------- VALIDATION ---------------- */

    if (!storeId) {
      return buildError("storeId is required");
    }

    if (!storeSlug) {
      return buildError("storeSlug is required");
    }

    if (!customer.name) {
      return buildError("Customer name is required");
    }

    if (!customer.phone || customer.phone.length < 10) {
      return buildError("Valid customer phone is required");
    }

    if (!customer.address) {
      return buildError("Customer address is required");
    }

    if (!customer.city) {
      return buildError("Customer city is required");
    }

    if (!customer.pincode || customer.pincode.length !== 6) {
      return buildError("Valid pincode is required");
    }

    if (!["cod", "online"].includes(paymentMethod)) {
      return buildError("Valid payment method is required");
    }

    if (!items.length) {
      return buildError("At least one item is required");
    }

    if (
      requestedSubtotal < 0 ||
      requestedDeliveryCharge < 0 ||
      requestedTotalAmount < 0
    ) {
      return buildError("Invalid amount values");
    }

    /* ---------------- STORE CHECK ---------------- */

    const storeRef = adminDb.collection("stores").doc(storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      return buildError("Store not found", 404);
    }

    const storeData = storeSnap.data() || {};

    if (toString(storeData?.slug) !== storeSlug) {
      return buildError("Store slug does not match storeId", 400);
    }

    const privateRef = adminDb.collection("store_private").doc(storeId);
    const privateSnap = await privateRef.get();
    const privateData = privateSnap.exists ? privateSnap.data() || {} : {};

    const storeTimings = privateData?.storeTimings || {};
    const orderSettings = privateData?.orderSettings || {};
    const paymentMethods = privateData?.paymentMethods || {};
    const deliverySettings = privateData?.deliverySettings || {};

    const isStoreClosed =
      storeData?.isActive === false ||
      storeTimings?.acceptOrdersNow === false ||
      storeTimings?.vacationMode === true ||
      storeTimings?.temporaryClosure === true;

    if (isStoreClosed) {
      return buildError("Store is not accepting orders right now", 400);
    }

    const minOrderAmount = toNumber(orderSettings?.minimumOrderAmount);
    const maximumOrderQuantity = toNumber(orderSettings?.maximumOrderQuantity);
    const codLimitAmount = toNumber(orderSettings?.codLimitAmount);
    const codEnabled = paymentMethods?.codEnabled !== false;

    const totalQty = items.reduce(
      (sum, item) => sum + toNumber(item.quantity),
      0
    );

    if (maximumOrderQuantity > 0 && totalQty > maximumOrderQuantity) {
      return buildError(`Maximum ${maximumOrderQuantity} items allowed`, 400);
    }

    if (paymentMethod === "cod" && !codEnabled) {
      return buildError("COD is not available for this store", 400);
    }

    if (paymentMethod === "online") {
      return buildError(
        "Use /api/create-razorpay-order for online payments, then verify payment",
        400
      );
    }

    /* ---------------- FETCH PRODUCT DETAILS ---------------- */

    const productsRef = adminDb.collection("products");

    const productSnaps = await Promise.all(
      items.map((item) => productsRef.doc(item.id).get())
    );

    const savedOrderItems = [];
    let computedSubtotal = 0;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const productSnap = productSnaps[index];

      if (!productSnap.exists) {
        return buildError("Product not found", 404);
      }

      const product = productSnap.data() || {};
      const qty = toNumber(item.quantity);
      const price = toNumber(product?.price);
      const stock = toNumber(product?.stock ?? product?.availableStock ?? 0);

      if (qty <= 0) {
        return buildError("Invalid quantity", 400);
      }

      if (stock < qty) {
        return buildError(
          `Only ${stock} left for ${toString(product?.name)}`,
          400
        );
      }

      const itemSubtotal = price * qty;
      computedSubtotal += itemSubtotal;

      savedOrderItems.push({
        id: item.id,
        name: toString(product?.name),
        category: toString(product?.category || product?.categoryName),
        price,
        quantity: qty,
        subtotal: itemSubtotal,
        image:
          (Array.isArray(product?.images) && product.images[0]) ||
          toString(product?.image),
      });
    }

    /* ---------------- FINAL TOTAL CALCULATION ---------------- */

    if (minOrderAmount > 0 && computedSubtotal < minOrderAmount) {
      return buildError(`Minimum order amount is ₹${minOrderAmount}`, 400);
    }

    let finalDeliveryCharge = requestedDeliveryCharge;

    if (deliverySettings?.deliveryEnabled === false) {
      finalDeliveryCharge = 0;
    } else {
      const configuredDeliveryCharge = toNumber(
        deliverySettings?.deliveryCharge
      );

      const freeDeliveryThreshold = toNumber(
        deliverySettings?.freeDeliveryThreshold
      );

      finalDeliveryCharge =
        freeDeliveryThreshold > 0 && computedSubtotal >= freeDeliveryThreshold
          ? 0
          : configuredDeliveryCharge;
    }

    const finalTotalAmount = computedSubtotal + finalDeliveryCharge;

    if (
      requestedSubtotal > 0 &&
      Math.abs(requestedSubtotal - computedSubtotal) > 0.01
    ) {
      return buildError("Subtotal mismatch", 400);
    }

    if (
      requestedTotalAmount > 0 &&
      Math.abs(requestedTotalAmount - finalTotalAmount) > 0.01
    ) {
      return buildError("Total amount mismatch", 400);
    }

    if (codLimitAmount > 0 && finalTotalAmount > codLimitAmount) {
      return buildError(`COD allowed only below ₹${codLimitAmount}`, 400);
    }

    /* ---------------- SAVE ORDER ---------------- */

    const now = new Date();
    const orderId = generateOrderId();

    const orderDoc = {
      orderId,

      storeId,
      storeSlug,
      storeName: toString(storeData?.storeName),

      customer,

      items: savedOrderItems,

      subtotal: computedSubtotal,
      deliveryCharge: finalDeliveryCharge,
      totalAmount: finalTotalAmount,

      paymentMethod: "cod",
      paymentStatus: "pending",
      orderStatus: "new",

      notes,

      currency: "INR",
      source: "website",

      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdAtMs: Date.now(),
    };

    await adminDb.collection("orders").doc(orderId).set(orderDoc);

    /* ---------------- UPDATE STOCK ---------------- */

    const batch = adminDb.batch();

    savedOrderItems.forEach((item, index) => {
      const productSnap = productSnaps[index];
      const product = productSnap.data() || {};
      const currentStock = toNumber(
        product?.stock ?? product?.availableStock ?? 0
      );

      const newStock = Math.max(0, currentStock - toNumber(item.quantity));

      batch.update(productsRef.doc(item.id), {
        stock: newStock,
        availableStock: newStock,
        inStock: newStock > 0,
        updatedAt: now.toISOString(),
      });
    });

    await batch.commit();

    /* ---------------- WEBHOOK TRIGGER ---------------- */

    let webhookTriggered = false;
    let webhookError = "";
    let webhookStatus = 0;
    let webhookResponseText = "";

    try {
      const webhookPayload = {
        event: "order_created",

        order_id: orderId,

        store_id: storeId,
        store_slug: storeSlug,
        store_name: toString(storeData?.storeName),
        store_phone: toString(
          privateData?.storeProfile?.phone ||
            privateData?.storePhone ||
            storeData?.phone
        ),

        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email,
        customer_address: customer.address,
        customer_city: customer.city,
        customer_pincode: customer.pincode,

        payment_method: "cod",
        payment_status: "pending",
        order_status: "new",

        subtotal: computedSubtotal,
        delivery_charge: finalDeliveryCharge,
        order_total: finalTotalAmount,

        items: savedOrderItems,

        notes,
        triggered_at: now.toISOString(),
      };

      const webhookResults = [];

      const webhookConfigs = [
        {
          key: "wh1",
          name: "Order Confirmed → Customer",
          config: privateData?.webhooks?.wh1 || privateData?.wh1,
        },
        {
          key: "wh3",
          name: "New Order Alert → Admin",
          config: privateData?.webhooks?.wh3 || privateData?.wh3,
        },
      ];

      for (const webhook of webhookConfigs) {
        const config = webhook.config || {};

        const enabled = config?.enabled === true;

        const webhookValue = enabled
          ? toString(config?.curl || config?.url || config?.webhookUrl)
          : "";

        if (!webhookValue) {
          webhookResults.push({
            key: webhook.key,
            name: webhook.name,
            triggered: false,
            status: 0,
            error: "Webhook is disabled or URL is missing",
          });

          continue;
        }

        try {
          const result = await sendConfiguredWebhook(webhookValue, {
            ...webhookPayload,
            webhook_key: webhook.key,
            webhook_name: webhook.name,
          });

          webhookResults.push({
            key: webhook.key,
            name: webhook.name,
            triggered: result.ok,
            status: result.status || 0,
            error: result.ok
              ? ""
              : result.message || result.responseText || "Webhook trigger failed",
            responseText: result.responseText || "",
          });
        } catch (err) {
          webhookResults.push({
            key: webhook.key,
            name: webhook.name,
            triggered: false,
            status: 0,
            error: toString(err?.message || "Webhook trigger failed"),
          });
        }
      }

      webhookTriggered = webhookResults.some((item) => item.triggered);

      webhookStatus =
        webhookResults.find((item) => item.key === "wh3")?.status ||
        webhookResults.find((item) => item.triggered)?.status ||
        0;

      webhookError = webhookResults
        .filter((item) => !item.triggered)
        .map((item) => `${item.name}: ${item.error}`)
        .join(" | ");

      webhookResponseText = JSON.stringify(webhookResults);

      console.log("Order created webhook results:", webhookResults);
    } catch (err) {
      webhookTriggered = false;
      webhookError = toString(err?.message || "Webhook trigger failed");
      console.error("Webhook trigger error:", err);
    }

    return NextResponse.json({
      success: true,
      orderId,

      paymentMethod: "cod",
      paymentStatus: "pending",
      orderStatus: "new",

      webhookTriggered,
      webhookStatus,
      webhookError,
      webhookResponseText,
    });
  } catch (error) {
    console.error("place-order error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to place order",
      },
      { status: 500 }
    );
  }
}