import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

/* ---------------- HELPERS ---------------- */

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toStr(val) {
  return String(val ?? "").trim();
}

function replacePlaceholders(input = "", payload = {}) {
  let output = String(input || "");

  Object.entries(payload).forEach(([key, value]) => {
    const token = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    output = output.replace(token, String(value ?? ""));
  });

  return output;
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

  const urlMatch = normalized.match(/https?:\/\/[^\s'"]+/i);
  if (urlMatch) result.url = urlMatch[0];

  const headerRegex = /(?:-H|--header)\s+(['"])(.*?)\1/gi;
  let match;
  while ((match = headerRegex.exec(normalized))) {
    const idx = match[2].indexOf(":");
    if (idx > -1) {
      const k = match[2].slice(0, idx).trim();
      const v = match[2].slice(idx + 1).trim();
      if (k) result.headers[k] = v;
    }
  }

  const dataMatch =
    normalized.match(/--data-raw\s+'([\s\S]*?)'/) ||
    normalized.match(/--data\s+'([\s\S]*?)'/) ||
    normalized.match(/--data-binary\s+'([\s\S]*?)'/);

  if (dataMatch) result.body = dataMatch[1];

  return result;
}

async function triggerCurlWebhook(curl, payload) {
  try {
    if (!curl) return false;

    const parsed = parseCurl(curl);
    if (!parsed.url) return false;

    const finalUrl = replacePlaceholders(parsed.url, payload);

    const finalHeaders = {};
    Object.entries(parsed.headers || {}).forEach(([key, value]) => {
      finalHeaders[key] = replacePlaceholders(value, payload);
    });

    const finalBody = parsed.body
      ? replacePlaceholders(parsed.body, payload)
      : undefined;

    const res = await fetch(finalUrl, {
      method: parsed.method || "POST",
      headers: finalHeaders,
      body: finalBody,
    });

    return res.ok;
  } catch (err) {
    console.error("Webhook error:", err);
    return false;
  }
}

/* ---------------- MAIN FUNCTION ---------------- */

export async function placeOrderServer(body) {
  const {
    orderId = "",
    storeId,
    storeSlug,
    customer,
    items,
    paymentMethod = "cod",
    paymentStatus,
    status,
    notes = "",
    subtotal = 0,
    deliveryCharge = 0,
    totalAmount = 0,
    orderIdPrefix = "QRT",
    razorpayPaymentId = "",
    razorpayOrderId = "",
    razorpaySignature = "",
  } = body || {};

  if (!adminDb) {
    throw new Error("Database not initialized");
  }

  const safeStoreId = toStr(storeId);
  const safeStoreSlug = toStr(storeSlug);
  const incomingOrderId = toStr(orderId);

  if (!safeStoreId) throw new Error("storeId is required");

  if (
    !customer?.name ||
    !customer?.phone ||
    !customer?.address
  ) {
    throw new Error("Customer details missing");
  }

  if (!Array.isArray(items) || !items.length) {
    throw new Error("Items missing");
  }

  const productsRef = adminDb.collection("products");
  const ordersRef = adminDb.collection("orders");

  const [storeSnap, privateSnap, productSnaps] = await Promise.all([
    adminDb.collection("stores").doc(safeStoreId).get(),
    adminDb.collection("store_private").doc(safeStoreId).get(),
    Promise.all(
      items.map((item) => productsRef.doc(toStr(item?.id)).get())
    ),
  ]);

  if (!storeSnap.exists) throw new Error("Store not found");

  const storeData = storeSnap.data() || {};
  const privateData = privateSnap.exists ? privateSnap.data() || {} : {};
  const webhooks = privateData?.webhooks || {};

  const normalizedItems = [];
  let computedSubtotal = 0;

  items.forEach((item, index) => {
    const productSnap = productSnaps[index];

    if (!productSnap.exists) {
      throw new Error("Product not found");
    }

    const product = productSnap.data() || {};
    const qty = toNumber(item?.quantity);

    if (qty <= 0) {
      throw new Error("Invalid quantity");
    }

    const stock = toNumber(
      product?.stock ?? product?.availableStock ?? 0
    );

    if (stock < qty) {
      throw new Error(`Only ${stock} left for ${product?.name || "product"}`);
    }

    const price = toNumber(product?.price);
    const itemSubtotal = price * qty;

    computedSubtotal += itemSubtotal;

    normalizedItems.push({
      id: toStr(item?.id),
      name: toStr(product?.name),
      category: toStr(product?.category || product?.categoryName),
      price,
      quantity: qty,
      subtotal: itemSubtotal,
      image:
        (Array.isArray(product?.images) && product.images[0]) ||
        product?.image ||
        "",
    });
  });

  const safeDeliveryCharge = toNumber(deliveryCharge);
  const finalSubtotal = computedSubtotal;
  const finalTotal =
    finalSubtotal + safeDeliveryCharge;

  const requestedSubtotal = toNumber(subtotal);
  const requestedTotalAmount = toNumber(totalAmount);

  if (requestedSubtotal > 0 && requestedSubtotal !== finalSubtotal) {
    throw new Error("Subtotal mismatch");
  }

  if (requestedTotalAmount > 0 && requestedTotalAmount !== finalTotal) {
    throw new Error("Total amount mismatch");
  }

  const orderRef = incomingOrderId
    ? ordersRef.doc(incomingOrderId)
    : ordersRef.doc();

  const resolvedPaymentStatus =
    toStr(paymentStatus) ||
    (paymentMethod === "cod" ? "pending" : "paid");

  const resolvedOrderStatus =
    toStr(status) || "placed";

  

  const batch = adminDb.batch();

  batch.set(orderRef, {
    orderId: orderRef.id,
    

    storeId: safeStoreId,
    storeSlug: safeStoreSlug || toStr(storeData?.slug),
    storeName: toStr(storeData?.storeName),

    customer: {
      name: toStr(customer?.name),
      phone: toStr(customer?.phone),
      email: toStr(customer?.email),
      address: toStr(customer?.address),
      city: toStr(customer?.city),
      pincode: toStr(customer?.pincode),
    },

    items: normalizedItems,

    subtotal: finalSubtotal,
    deliveryCharge: safeDeliveryCharge,
    totalAmount: finalTotal,

    paymentMethod: toStr(paymentMethod),
    paymentStatus: resolvedPaymentStatus,
    orderStatus: resolvedOrderStatus,

    notes: toStr(notes),

    razorpayPaymentId: toStr(razorpayPaymentId),
    razorpayOrderId: toStr(razorpayOrderId),
    razorpaySignature: toStr(razorpaySignature),

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  normalizedItems.forEach((item, index) => {
    const product = productSnaps[index].data() || {};
    const currentStock = toNumber(
      product?.stock ?? product?.availableStock ?? 0
    );
    const newStock = Math.max(0, currentStock - item.quantity);

    batch.update(productsRef.doc(item.id), {
      stock: newStock,
      availableStock: newStock,
      inStock: newStock > 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  const payload = {
    order_id: orderRef.id,
    
    customer_name: toStr(customer?.name),
    customer_phone: toStr(customer?.phone),
    order_total: String(finalTotal),
    order_status: resolvedOrderStatus,
    payment_status: resolvedPaymentStatus,
    payment_method: toStr(paymentMethod),
    items_json: JSON.stringify(normalizedItems),
    store_id: safeStoreId,
    store_slug: safeStoreSlug || toStr(storeData?.slug),
    store_name: toStr(storeData?.storeName),
  };

  if (webhooks?.wh1?.enabled && webhooks?.wh1?.curl) {
    triggerCurlWebhook(webhooks.wh1.curl, payload);
  }

  if (webhooks?.wh3?.enabled && webhooks?.wh3?.curl) {
    triggerCurlWebhook(webhooks.wh3.curl, payload);
  }

  return {
    success: true,
    orderId: orderRef.id,

  };
}