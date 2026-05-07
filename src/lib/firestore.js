import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ---------------------------
   HELPERS
--------------------------- */
function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toTrimmedString(value = "") {
  return String(value ?? "").trim();
}

function normalizeSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCustomDomain(value = "") {
  return String(value || "")
    .replace("https://", "")
    .replace("http://", "")
    .split("/")[0]
    .toLowerCase()
    .trim();
}

function normalizeCustomDomains(value = []) {
  if (!Array.isArray(value)) return [];

  const cleaned = value.map(normalizeCustomDomain).filter(Boolean);

  return Array.from(new Set(cleaned));
}

function normalizeCategoryName(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function makeCategoryId(name = "") {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeImages(images, image) {
  if (Array.isArray(images)) {
    return images
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  if (image) {
    const single = String(image || "").trim();
    return single ? [single] : [];
  }

  return [];
}

function normalizeCategories(categories = []) {
  if (!Array.isArray(categories)) return [];

  const mapped = categories
    .map((category, index) => {
      const rawName =
        typeof category === "string"
          ? category
          : category?.name || category || "";

      const name = normalizeCategoryName(rawName);
      if (!name) return null;

      const icon =
        typeof category === "string"
          ? "📦"
          : String(category?.icon || "📦").trim().slice(0, 2) || "📦";

      return {
        id:
          String(typeof category === "string" ? "" : category?.id || "").trim() ||
          makeCategoryId(name) ||
          `category-${index + 1}`,
        name,
        icon,
        sortOrder:
          typeof category === "object" && typeof category?.sortOrder === "number"
            ? category.sortOrder
            : index,
      };
    })
    .filter(Boolean);

  const uniqueMap = new Map();

  mapped.forEach((category) => {
    if (!uniqueMap.has(category.id)) {
      uniqueMap.set(category.id, category);
    }
  });

  return Array.from(uniqueMap.values()).sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );
}

function normalizeProductPayload(data = {}) {
  const images = normalizeImages(data.images, data.image);
  const stock = toNumber(data.stock, 0);
  const category = normalizeCategoryName(data.category || "");
  const categoryId =
    toTrimmedString(data.categoryId) || makeCategoryId(category);

  return {
    ownerId: toTrimmedString(data.ownerId),
    storeId: toTrimmedString(data.storeId),
    name: toTrimmedString(data.name),

    price: toNumber(data.price, 0),
    images,
    image: images[0] || "",
    category,
    categoryId,
    description: toTrimmedString(data.description),
    stock,
    availableStock: stock,
    inStock: stock > 0,
    stockStatus: stock > 0 ? "in_stock" : "out_of_stock",
    isActive: data.isActive !== false,
  };
}

/* ---------------------------
   STORES (PUBLIC)
--------------------------- */
export async function getStoreByOwnerId(ownerId) {
  try {
    if (!ownerId) return null;

    const storesRef = collection(db, "stores");
    const q = query(storesRef, where("ownerId", "==", ownerId), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const storeDoc = snapshot.docs[0];

    return {
      id: storeDoc.id,
      ...storeDoc.data(),
    };
  } catch (error) {
    console.error("Error fetching store by ownerId:", error);
    throw error;
  }
}

export async function getStoreBySlug(slug) {
  try {
    if (!slug || typeof slug !== "string") return null;

    const storesRef = collection(db, "stores");
    const q = query(
      storesRef,
      where("slug", "==", normalizeSlug(slug)),
      where("isActive", "==", true),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const storeDoc = snapshot.docs[0];

    return {
      id: storeDoc.id,
      ...storeDoc.data(),
    };
  } catch (error) {
    console.error("Error fetching store by slug:", error);
    throw error;
  }
}

export async function getStoreByCustomDomain(domain) {
  try {
    if (!domain || typeof domain !== "string") return null;

    const cleanDomain = normalizeCustomDomain(domain);

    if (!cleanDomain) return null;

    const storesRef = collection(db, "stores");
    const q = query(
      storesRef,
      where("customDomains", "array-contains", cleanDomain),
      where("isActive", "==", true),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const storeDoc = snapshot.docs[0];

    return {
      id: storeDoc.id,
      ...storeDoc.data(),
    };
  } catch (error) {
    console.error("Error fetching store by custom domain:", error);
    throw error;
  }
}

export async function getStoreBySlugOrDomain(value) {
  try {
    if (!value || typeof value !== "string") return null;

    const cleanValue = normalizeCustomDomain(value);

    if (!cleanValue) return null;

    // Custom subdomain/domain example:
    // shop.ambica.com
    if (cleanValue.includes(".")) {
      return await getStoreByCustomDomain(cleanValue);
    }

    // Normal slug example:
    // app.qartlo.com/ambica
    return await getStoreBySlug(cleanValue);
  } catch (error) {
    console.error("Error fetching store by slug or domain:", error);
    throw error;
  }
}

export async function isCustomDomainAvailable(domain, currentStoreId = "") {
  try {
    const cleanDomain = normalizeCustomDomain(domain);

    if (!cleanDomain) return false;

    const storesRef = collection(db, "stores");
    const q = query(
      storesRef,
      where("customDomains", "array-contains", cleanDomain),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return true;

    const existingStoreId = snapshot.docs[0].id;

    return String(existingStoreId) === String(currentStoreId);
  } catch (error) {
    console.error("Error checking custom domain availability:", error);
    throw error;
  }
}

export async function getStoreById(storeId) {
  try {
    if (!storeId) return null;

    const ref = doc(db, "stores", storeId);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) return null;

    return {
      id: snapshot.id,
      ...snapshot.data(),
    };
  } catch (error) {
    console.error("Error fetching store by id:", error);
    throw error;
  }
}

export async function createStore(data) {
  try {
    const normalizedCategories = normalizeCategories(data.customCategories || []);
    const normalizedCustomDomains = normalizeCustomDomains(data.customDomains || []);
    const primaryDomain =
      normalizeCustomDomain(data.primaryDomain || "") ||
      normalizedCustomDomains[0] ||
      "";

    const docRef = await addDoc(collection(db, "stores"), {
      ownerId: toTrimmedString(data.ownerId),
      storeName: toTrimmedString(data.storeName),
      slug: normalizeSlug(data.slug || data.storeName || ""),

      customDomains: normalizedCustomDomains,
      primaryDomain,
      customDomainStatus: toTrimmedString(data.customDomainStatus || ""),

      phone: toTrimmedString(data.phone),
      address: toTrimmedString(data.address),
      storeDescription: toTrimmedString(data.storeDescription),
      isActive: data.isActive !== false,

      catalogConfig: {
        showOutOfStock: data.showOutOfStock !== false,
        searchEnabled: data.searchEnabled !== false,
        productFiltersEnabled: data.productFiltersEnabled !== false,
        featuredProductsEnabled: data.featuredProductsEnabled !== false,
        hideEmptyCategories: data.hideEmptyCategories === true,
        defaultProductSort: toTrimmedString(data.defaultProductSort) || "manual",

        customCategories: normalizedCategories,
      },

      customCategories: normalizedCategories,

      paymentConfig: {
        razorpayEnabled: data.razorpayEnabled === true,
        razorpayKeyId: toTrimmedString(data.razorpayKeyId),
      },

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating store:", error);
    throw error;
  }
}

export async function updateStore(storeId, data) {
  try {
    if (!storeId) {
      throw new Error("storeId is required");
    }

    const storeRef = doc(db, "stores", storeId);
    const normalizedCategories = normalizeCategories(
      data.customCategories || data.catalogConfig?.customCategories || []
    );

    const normalizedCustomDomains = normalizeCustomDomains(data.customDomains || []);
    const primaryDomain =
      normalizeCustomDomain(data.primaryDomain || "") ||
      normalizedCustomDomains[0] ||
      "";

    await updateDoc(storeRef, {
      storeName: toTrimmedString(data.storeName),
      slug: normalizeSlug(data.slug || ""),

      customDomains: normalizedCustomDomains,
      primaryDomain,
      customDomainStatus: toTrimmedString(data.customDomainStatus || ""),

      phone: toTrimmedString(data.phone),
      address: toTrimmedString(data.address),
      storeDescription: toTrimmedString(data.storeDescription),
      isActive: data.isActive !== false,

      catalogConfig: {
        showOutOfStock:
          data.catalogConfig?.showOutOfStock ?? data.showOutOfStock ?? true,
        searchEnabled:
          data.catalogConfig?.searchEnabled ?? data.searchEnabled ?? true,
        productFiltersEnabled:
          data.catalogConfig?.productFiltersEnabled ??
          data.productFiltersEnabled ??
          true,
        featuredProductsEnabled:
          data.catalogConfig?.featuredProductsEnabled ??
          data.featuredProductsEnabled ??
          true,
        hideEmptyCategories:
          data.catalogConfig?.hideEmptyCategories ??
          data.hideEmptyCategories ??
          false,
        defaultProductSort:
          toTrimmedString(data.catalogConfig?.defaultProductSort) ||
          toTrimmedString(data.defaultProductSort) ||
          "manual",

        customCategories: normalizedCategories,
      },

      customCategories: normalizedCategories,

      paymentConfig: {
        razorpayEnabled: data.razorpayEnabled === true,
        razorpayKeyId: toTrimmedString(data.razorpayKeyId),
      },

      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating store:", error);
    throw error;
  }
}

/* ---------------------------
   STORE PRIVATE (SECURE)
--------------------------- */
export async function getStorePrivate(storeId) {
  try {
    if (!storeId) return null;

    const ref = doc(db, "store_private", storeId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    return {
      id: snap.id,
      ...snap.data(),
    };
  } catch (error) {
    console.error("Error fetching store private:", error);
    throw error;
  }
}

export async function upsertStorePrivate(storeId, data) {
  try {
    if (!storeId) {
      throw new Error("storeId is required");
    }

    const ref = doc(db, "store_private", storeId);
    const normalizedCategories = normalizeCategories(data.customCategories || []);

    await setDoc(
      ref,
      {
        ownerId: toTrimmedString(data.ownerId),

        supportEmail: toTrimmedString(data.supportEmail),
        businessType: toTrimmedString(data.businessType),
        gstNumber: toTrimmedString(data.gstNumber),

        storeDescription: toTrimmedString(data.storeDescription),
        showOutOfStock: data.showOutOfStock !== false,
        customCategories: normalizedCategories,

        branding: {
          storeLogo:
            toTrimmedString(data.branding?.storeLogo) ||
            toTrimmedString(data.storeLogo),

          coverBanner:
            toTrimmedString(data.branding?.coverBanner) ||
            toTrimmedString(data.coverBanner),
          themeColor:
            toTrimmedString(data.branding?.themeColor) ||
            toTrimmedString(data.themeColor) ||
            "#128c7e",
          buttonColor:
            toTrimmedString(data.branding?.buttonColor) ||
            toTrimmedString(data.buttonColor) ||
            "#128c7e",
          accentColor:
            toTrimmedString(data.branding?.accentColor) ||
            toTrimmedString(data.accentColor) ||
            "#25d366",
          fontStyle:
            toTrimmedString(data.branding?.fontStyle) ||
            toTrimmedString(data.fontStyle) ||
            "inter",
          homepageLayout:
            toTrimmedString(data.branding?.homepageLayout) ||
            toTrimmedString(data.homepageLayout) ||
            "grid",
          productCardStyle:
            toTrimmedString(data.branding?.productCardStyle) ||
            toTrimmedString(data.productCardStyle) ||
            "standard",
        },

        catalogSettings: {
          hideEmptyCategories:
            data.catalogSettings?.hideEmptyCategories ??
            data.hideEmptyCategories ??
            false,
          defaultProductSort:
            toTrimmedString(data.catalogSettings?.defaultProductSort) ||
            toTrimmedString(data.defaultProductSort) ||
            "manual",
          searchEnabled:
            data.catalogSettings?.searchEnabled ?? data.searchEnabled ?? true,
          featuredProductsEnabled:
            data.catalogSettings?.featuredProductsEnabled ??
            data.featuredProductsEnabled ??
            true,
          productFiltersEnabled:
            data.catalogSettings?.productFiltersEnabled ??
            data.productFiltersEnabled ??
            true,
          wishlistEnabled:
            data.catalogSettings?.wishlistEnabled ??
            data.wishlistEnabled ??
            false,
        },

        orderSettings: {
          minimumOrderAmount: toNumber(
            data.orderSettings?.minimumOrderAmount ?? data.minimumOrderAmount,
            0
          ),
          maximumOrderQuantity: toNumber(
            data.orderSettings?.maximumOrderQuantity ?? data.maximumOrderQuantity,
            0
          ),
          allowGuestCheckout:
            data.orderSettings?.allowGuestCheckout ??
            data.allowGuestCheckout ??
            true,
          requireLoginForCheckout:
            data.orderSettings?.requireLoginForCheckout ??
            data.requireLoginForCheckout ??
            false,
          enableOrderNotes:
            data.orderSettings?.enableOrderNotes ??
            data.enableOrderNotes ??
            true,
          autoConfirmOrders:
            data.orderSettings?.autoConfirmOrders ??
            data.autoConfirmOrders ??
            false,
          orderIdPrefix:
            toTrimmedString(data.orderSettings?.orderIdPrefix) ||
            toTrimmedString(data.orderIdPrefix) ||
            "QRT",
          cartExpiryMinutes: toNumber(
            data.orderSettings?.cartExpiryMinutes ?? data.cartExpiryMinutes,
            60
          ),
          allowOrderCancellation:
            data.orderSettings?.allowOrderCancellation ??
            data.allowOrderCancellation ??
            true,
          codLimitAmount: toNumber(
            data.orderSettings?.codLimitAmount ?? data.codLimitAmount,
            0
          ),
        },

        deliverySettings: {
          deliveryEnabled:
            data.deliverySettings?.deliveryEnabled ??
            data.deliveryEnabled ??
            true,
          pickupEnabled:
            data.deliverySettings?.pickupEnabled ??
            data.pickupEnabled ??
            false,
          deliveryCharge: toNumber(
            data.deliverySettings?.deliveryCharge ?? data.deliveryCharge,
            0
          ),
          freeDeliveryThreshold: toNumber(
            data.deliverySettings?.freeDeliveryThreshold ??
              data.freeDeliveryThreshold,
            0
          ),
          estimatedDeliveryTime:
            toTrimmedString(data.deliverySettings?.estimatedDeliveryTime) ||
            toTrimmedString(data.estimatedDeliveryTime),
          sameDayDeliveryEnabled:
            data.deliverySettings?.sameDayDeliveryEnabled ??
            data.sameDayDeliveryEnabled ??
            false,
          deliveryAreas:
            toTrimmedString(data.deliverySettings?.deliveryAreas) ||
            toTrimmedString(data.deliveryAreas),
          shippingNote:
            toTrimmedString(data.deliverySettings?.shippingNote) ||
            toTrimmedString(data.shippingNote),
          pickupInstructions:
            toTrimmedString(data.deliverySettings?.pickupInstructions) ||
            toTrimmedString(data.pickupInstructions),
          areaWiseDeliveryCharge:
            toTrimmedString(data.deliverySettings?.areaWiseDeliveryCharge) ||
            toTrimmedString(data.areaWiseDeliveryCharge),
        },

        razorpayKeySecret: toTrimmedString(data.razorpayKeySecret),
        razorpayWebhookSecret: toTrimmedString(data.razorpayWebhookSecret),
        razorpayMode: toTrimmedString(data.razorpayMode) || "test",

        paymentMethods: {
          codEnabled:
            data.paymentMethods?.codEnabled ?? data.codEnabled ?? true,
          bankTransferEnabled:
            data.paymentMethods?.bankTransferEnabled ??
            data.bankTransferEnabled ??
            false,
          upiId:
            toTrimmedString(data.paymentMethods?.upiId) ||
            toTrimmedString(data.upiId),
          paymentInstructions:
            toTrimmedString(data.paymentMethods?.paymentInstructions) ||
            toTrimmedString(data.paymentInstructions),
        },

        bankDetails: {
          accountNumber:
            toTrimmedString(data.bankDetails?.accountNumber) ||
            toTrimmedString(data.bankAccountNumber),
          ifsc:
            toTrimmedString(data.bankDetails?.ifsc) ||
            toTrimmedString(data.bankIfsc),
          accountName:
            toTrimmedString(data.bankDetails?.accountName) ||
            toTrimmedString(data.bankAccountName),
        },

        notificationSettings: {
          customerWhatsAppNotifications:
            data.notificationSettings?.customerWhatsAppNotifications ??
            data.customerWhatsAppNotifications ??
            true,
          customerSmsNotifications:
            data.notificationSettings?.customerSmsNotifications ??
            data.customerSmsNotifications ??
            false,
          customerEmailNotifications:
            data.notificationSettings?.customerEmailNotifications ??
            data.customerEmailNotifications ??
            false,
          adminWhatsAppNotifications:
            data.notificationSettings?.adminWhatsAppNotifications ??
            data.adminWhatsAppNotifications ??
            true,
          adminEmailNotifications:
            data.notificationSettings?.adminEmailNotifications ??
            data.adminEmailNotifications ??
            false,
          adminNotificationPhone:
            toTrimmedString(data.notificationSettings?.adminNotificationPhone) ||
            toTrimmedString(data.adminNotificationPhone),
          adminNotificationEmail:
            toTrimmedString(data.notificationSettings?.adminNotificationEmail) ||
            toTrimmedString(data.adminNotificationEmail),
          abandonedCartReminderEnabled:
            data.notificationSettings?.abandonedCartReminderEnabled ??
            data.abandonedCartReminderEnabled ??
            false,
        },

        webhooks:
          data.webhooks && typeof data.webhooks === "object" ? data.webhooks : {},

        storeTimings: {
          openingTime:
            toTrimmedString(data.storeTimings?.openingTime) ||
            toTrimmedString(data.openingTime) ||
            "09:00",
          closingTime:
            toTrimmedString(data.storeTimings?.closingTime) ||
            toTrimmedString(data.closingTime) ||
            "21:00",
          weeklyHolidays: Array.isArray(data.storeTimings?.weeklyHolidays)
            ? data.storeTimings.weeklyHolidays
            : Array.isArray(data.weeklyHolidays)
              ? data.weeklyHolidays
              : [],
          vacationMode:
            data.storeTimings?.vacationMode ?? data.vacationMode ?? false,
          temporaryClosure:
            data.storeTimings?.temporaryClosure ??
            data.temporaryClosure ??
            false,
          acceptOrdersNow:
            data.storeTimings?.acceptOrdersNow ?? data.acceptOrdersNow ?? true,
          specialHolidayHours:
            toTrimmedString(data.storeTimings?.specialHolidayHours) ||
            toTrimmedString(data.specialHolidayHours),
        },

        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error upserting store private:", error);
    throw error;
  }
}

export async function updateStorePrivate(storeId, data) {
  try {
    if (!storeId) {
      throw new Error("storeId is required");
    }

    const ref = doc(db, "store_private", storeId);

    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating store private:", error);
    throw error;
  }
}

/* ---------------------------
   PRODUCTS
--------------------------- */
export async function getProductsByStoreId(storeId) {
  try {
    if (!storeId) return [];

    const productsRef = collection(db, "products");
    const q = query(productsRef, where("storeId", "==", storeId));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))
      .filter((item) => item?.isActive !== false)
      .sort((a, b) => {
        const aSeconds =
          typeof a?.createdAt?.seconds === "number" ? a.createdAt.seconds : 0;
        const bSeconds =
          typeof b?.createdAt?.seconds === "number" ? b.createdAt.seconds : 0;
        return bSeconds - aSeconds;
      });
  } catch (error) {
    console.error("Error fetching products by storeId:", error);
    throw error;
  }
}

export async function createProduct(data) {
  try {
    const payload = normalizeProductPayload(data);

    const docRef = await addDoc(collection(db, "products"), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating product:", error);
    throw error;
  }
}

export async function addProduct(data) {
  return createProduct(data);
}

export async function updateProduct(productId, data) {
  try {
    if (!productId) {
      throw new Error("productId is required");
    }

    const productRef = doc(db, "products", productId);
    const existingSnap = await getDoc(productRef);

    if (!existingSnap.exists()) {
      throw new Error("Product not found");
    }

    const existingData = existingSnap.data();
    const normalized = normalizeProductPayload({
      ...existingData,
      ...data,
      images:
        Array.isArray(data?.images) || data?.image
          ? data.images || data.image
          : existingData?.images || existingData?.image || [],
    });

    await updateDoc(productRef, {
      ownerId: normalized.ownerId || toTrimmedString(existingData?.ownerId),
      storeId: normalized.storeId || toTrimmedString(existingData?.storeId),
      name: normalized.name,

      price: normalized.price,
      images: normalized.images,
      image: normalized.image,
      category: normalized.category,
      categoryId: normalized.categoryId,
      description: normalized.description,
      stock: normalized.stock,
      availableStock: normalized.availableStock,
      inStock: normalized.inStock,
      stockStatus: normalized.stockStatus,
      isActive: normalized.isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
}

export async function deleteProduct(productId) {
  try {
    if (!productId) {
      throw new Error("productId is required");
    }

    const productRef = doc(db, "products", productId);
    await deleteDoc(productRef);
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
}

/* ---------------------------
   ORDERS
--------------------------- */
export async function getOrdersByStoreId(storeId) {
  try {
    if (!storeId) return [];

    const ordersRef = collection(db, "orders");
    const q = query(
      ordersRef,
      where("storeId", "==", storeId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docItem) => {
      const data = docItem.data() || {};
      return {
        id: docItem.id,
        ...data,
        items: Array.isArray(data.items) ? data.items : [],
        totalAmount: toNumber(data.totalAmount, 0),
        subtotal: toNumber(data.subtotal, 0),
        deliveryCharge: toNumber(data.deliveryCharge, 0),
        paymentMethod: toTrimmedString(data.paymentMethod) || "cod",
        paymentStatus: toTrimmedString(data.paymentStatus) || "pending",
        orderStatus: toTrimmedString(data.orderStatus || data.status) || "new",
      };
    });
  } catch (error) {
    console.error("Error fetching orders by storeId:", error);
    throw error;
  }
}

export async function createOrder(data) {
  try {
    const normalizedItems = Array.isArray(data.items)
      ? data.items.map((item) => ({
          id: toTrimmedString(item?.id),
          name: toTrimmedString(item?.name),
          category: toTrimmedString(item?.category),
          price: toNumber(item?.price, 0),
          quantity: toNumber(item?.quantity, 0),
          subtotal:
            toNumber(item?.subtotal, 0) ||
            toNumber(item?.price, 0) * toNumber(item?.quantity, 0),
          image: toTrimmedString(item?.image),
        }))
      : [];

    const docRef = await addDoc(collection(db, "orders"), {
      orderId: "",

      storeId: toTrimmedString(data.storeId),
      storeSlug: toTrimmedString(data.storeSlug),
      storeName: toTrimmedString(data.storeName),
      ownerId: toTrimmedString(data.ownerId),

      customer: {
        name: toTrimmedString(data.customer?.name || data.customerName),
        phone: toTrimmedString(data.customer?.phone || data.phone),
        email: toTrimmedString(data.customer?.email),
        address: toTrimmedString(data.customer?.address || data.address),
        city: toTrimmedString(data.customer?.city),
        pincode: toTrimmedString(data.customer?.pincode),
      },

      items: normalizedItems,

      subtotal: toNumber(data.subtotal, 0),
      deliveryCharge: toNumber(data.deliveryCharge, 0),
      totalAmount: toNumber(data.totalAmount, 0),

      paymentMethod: toTrimmedString(data.paymentMethod) || "cod",
      paymentStatus: toTrimmedString(data.paymentStatus) || "pending",
      orderStatus: toTrimmedString(data.orderStatus) || "new",

      notes: toTrimmedString(data.notes),

      razorpayOrderId: toTrimmedString(data.razorpayOrderId),
      razorpayPaymentId: toTrimmedString(data.razorpayPaymentId),
      razorpaySignature: toTrimmedString(data.razorpaySignature),

      webhookEventType: toTrimmedString(data.webhookEventType),
      webhookEventId: toTrimmedString(data.webhookEventId),

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "orders", docRef.id), {
      orderId: docRef.id,
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
}

export async function createPendingOrder(data) {
  try {
    const normalizedItems = Array.isArray(data.items)
      ? data.items.map((item) => ({
          id: toTrimmedString(item?.id),
          name: toTrimmedString(item?.name),
          category: toTrimmedString(item?.category),
          price: toNumber(item?.price, 0),
          quantity: toNumber(item?.quantity, 0),
          subtotal:
            toNumber(item?.subtotal, 0) ||
            toNumber(item?.price, 0) * toNumber(item?.quantity, 0),
          image: toTrimmedString(item?.image),
        }))
      : [];

    const docRef = await addDoc(collection(db, "orders"), {
      orderId: "",

      storeId: toTrimmedString(data.storeId),
      storeSlug: toTrimmedString(data.storeSlug),
      storeName: toTrimmedString(data.storeName),
      ownerId: toTrimmedString(data.ownerId),

      customer: {
        name: toTrimmedString(data.customer?.name || data.customerName),
        phone: toTrimmedString(data.customer?.phone || data.phone),
        email: toTrimmedString(data.customer?.email),
        address: toTrimmedString(data.customer?.address || data.address),
        city: toTrimmedString(data.customer?.city),
        pincode: toTrimmedString(data.customer?.pincode),
      },

      items: normalizedItems,

      subtotal: toNumber(data.subtotal, 0),
      deliveryCharge: toNumber(data.deliveryCharge, 0),
      totalAmount: toNumber(data.totalAmount, 0),

      paymentMethod: toTrimmedString(data.paymentMethod) || "razorpay",
      paymentStatus: "created",
      orderStatus: "new",

      notes: toTrimmedString(data.notes),

      razorpayOrderId: "",
      razorpayPaymentId: "",
      razorpaySignature: "",

      webhookEventType: "",
      webhookEventId: "",

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "orders", docRef.id), {
      orderId: docRef.id,
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating pending order:", error);
    throw error;
  }
}

export async function updateOrderPayment(orderId, data) {
  try {
    if (!orderId) {
      throw new Error("orderId is required");
    }

    const orderRef = doc(db, "orders", orderId);

    await updateDoc(orderRef, {
      paymentMethod: toTrimmedString(data.paymentMethod) || "razorpay",
      paymentStatus: toTrimmedString(data.paymentStatus) || "paid",
      orderStatus: toTrimmedString(data.orderStatus) || "new",
      razorpayOrderId: toTrimmedString(data.razorpayOrderId),
      razorpayPaymentId: toTrimmedString(data.razorpayPaymentId),
      razorpaySignature: toTrimmedString(data.razorpaySignature),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating order payment:", error);
    throw error;
  }
}

export async function updateOrderStatus(orderId, data) {
  try {
    if (!orderId) {
      throw new Error("orderId is required");
    }

    const orderRef = doc(db, "orders", orderId);

    await updateDoc(orderRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
}