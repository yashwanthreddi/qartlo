"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { db } from "@/lib/firebase";
import useAuth from "@/hooks/useAuth";

const DEFAULT_WEBHOOKS = {
  wh1: {
    enabled: false,
    title: "Order Confirmed → Customer",
    description: "Fires when customer places an order",
    curl: "",
  },
  wh2: {
    enabled: false,
    title: "Order Status Update → Customer",
    description: "Fires when you accept, complete or cancel an order",
    curl: "",
  },
  wh3: {
    enabled: false,
    title: "New Order Alert → Admin",
    description: "Fires when a new order is placed and alerts your team",
    curl: "",
  },
};

const DEFAULT_FORM = {
  storeName: "",
  slug: "",
  phone: "",
  address: "",
  businessType: "",
  isActive: true,
  storeDescription: "",

  customDomain: "",
  customDomainStatus: "",

  storeLogo: "",
  themeColor: "#128c7e",
  buttonColor: "#128c7e",
  accentColor: "#25d366",
  fontStyle: "inter",
  homepageLayout: "grid",
  productCardStyle: "standard",

  showOutOfStock: true,
  hideEmptyCategories: false,
  defaultProductSort: "manual",
  searchEnabled: true,
  productFiltersEnabled: true,
  customCategories: [],

  minimumOrderAmount: "",
  maximumOrderQuantity: "",
  codLimitAmount: "",

  deliveryCharge: "",
  freeDeliveryThreshold: "",
  shippingNote: "",

  razorpayEnabled: false,
  razorpayKeyId: "",
  razorpayKeySecret: "",
  razorpayWebhookSecret: "",
  razorpayMode: "test",
  codEnabled: true,
  bankTransferEnabled: false,
  bankAccountNumber: "",
  bankIfsc: "",
  bankAccountName: "",
  upiId: "",
  paymentInstructions: "",

  customerWhatsAppNotifications: true,
  customerSmsNotifications: false,
  customerEmailNotifications: false,
  adminWhatsAppNotifications: true,
  adminEmailNotifications: false,
  adminNotificationPhone: "",
  adminNotificationEmail: "",
  abandonedCartReminderEnabled: false,
  webhooks: DEFAULT_WEBHOOKS,

  openingTime: "09:00",
  closingTime: "21:00",
  weeklyHolidays: [],
  vacationMode: false,
  temporaryClosure: false,
  acceptOrdersNow: true,
  specialHolidayHours: "",
};

function normalizeSlug(value) {
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
    .trim()
    .replace(/\/$/, "");
}

function isReservedDomain(domain) {
  const cleanDomain = normalizeCustomDomain(domain);

  const reservedDomains = [
    "app.qartlo.com",
    "qartlo.com",
    "www.qartlo.com",
    "localhost",
    "127.0.0.1",
  ];

  return reservedDomains.includes(cleanDomain);
}

function isValidDomain(domain) {
  const cleanDomain = normalizeCustomDomain(domain);

  if (!cleanDomain) return true;

  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleanDomain);
}

function normalizeCategoryName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function makeCategoryId(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeCategorySlug(name) {
  return makeCategoryId(name);
}

function normalizeCategoryItem(category, index = 0) {
  const name =
    typeof category === "string"
      ? normalizeCategoryName(category)
      : normalizeCategoryName(category?.name || "");

  if (!name) return null;

  const slug = makeCategorySlug(name) || `category-${index + 1}`;

  return {
    id: slug,
    slug,
    name,
    icon:
      typeof category === "string"
        ? "📦"
        : String(category?.icon || "📦").trim() || "📦",
  };
}

function toNumberOrZero(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function SectionCard({ title, subtitle, children, right }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 text-gray-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur [color-scheme:light]">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-gray-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

function SectionSaveButton({ onClick, loading, label = "Save" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-2xl bg-[#128c7e] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f7468] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Saving..." : label}
    </button>
  );
}

function InlineSectionNotice({ type = "success", message }) {
  if (!message) return null;

  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-green-200 bg-green-50 text-green-700";

  return (
    <div className={`rounded-2xl border px-4 py-2 text-xs font-semibold ${styles}`}>
      {message}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition [color-scheme:light] focus:border-[#128c7e] focus:ring-2 focus:ring-[#128c7e]/15 ${
        props.className || ""
      }`}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition [color-scheme:light] focus:border-[#128c7e] focus:ring-2 focus:ring-[#128c7e]/15 ${
        props.className || ""
      }`}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition [color-scheme:light] focus:border-[#128c7e] focus:ring-2 focus:ring-[#128c7e]/15 ${
        props.className || ""
      }`}
    />
  );
}

function ToggleRow({ title, subtitle, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-[#25d366]" : "bg-gray-300"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative h-7 w-12 rounded-full transition ${
        checked ? "bg-[#128c7e]" : "bg-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

function ImageUploadField({
  label,
  value,
  onChange,
  onRemove,
  uploading = false,
  accept = "image/*",
  previewClassName = "h-16 w-16",
}) {
  return (
    <Field label={label}>
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <input
          type="file"
          accept={accept}
          onChange={onChange}
          className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-xl file:border-0 file:bg-[#128c7e] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />

        <p className="mt-2 text-xs text-gray-500">
          Upload PNG, JPG, JPEG, WEBP, SVG, or ICO.
        </p>

        {uploading ? (
          <p className="mt-3 text-sm font-medium text-[#128c7e]">
            Uploading...
          </p>
        ) : null}

        {value ? (
          <div className="mt-4 flex items-center gap-4">
            <img
              src={value}
              alt={label}
              className={`${previewClassName} rounded-xl border border-gray-200 bg-white object-cover`}
            />
            <div className="flex flex-col gap-2">
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-[#128c7e] underline"
              >
                View uploaded image
              </a>
              <button
                type="button"
                onClick={onRemove}
                className="w-fit rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
              >
                Remove
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Field>
  );
}

export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();

  const [store, setStore] = useState(null);
  const [privateDocExists, setPrivateDocExists] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📦");

  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState("");
  const [testingWebhookKey, setTestingWebhookKey] = useState("");
  const [webhookTestResult, setWebhookTestResult] = useState({});
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [sectionMessages, setSectionMessages] = useState({});
  const [uploadingField, setUploadingField] = useState("");

  useEffect(() => {
    async function loadStore() {
      if (authLoading) return;

      if (!user) {
        setError("Please log in to access settings.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setCategoryError("");
        setSectionMessages({});

        const storesRef = collection(db, "stores");
        const q = query(storesRef, where("ownerId", "==", user.uid), limit(1));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
          setError("No store found for this account.");
          setStore(null);
          setLoading(false);
          return;
        }

        const storeDoc = querySnap.docs[0];
        const storeId = storeDoc.id;
        const storeData = {
          id: storeId,
          ...storeDoc.data(),
        };

        setStore(storeData);

        const privateRef = doc(db, "store_private", storeId);
        const privateSnap = await getDoc(privateRef);
        const privateData = privateSnap.exists() ? privateSnap.data() : {};

        setPrivateDocExists(privateSnap.exists());

        const savedCategoriesRaw = Array.isArray(privateData?.customCategories)
          ? privateData.customCategories
          : Array.isArray(storeData?.catalogConfig?.customCategories)
          ? storeData.catalogConfig.customCategories
          : Array.isArray(storeData?.customCategories)
          ? storeData.customCategories
          : [];

        const savedCategories = savedCategoriesRaw
          .map((category, index) => normalizeCategoryItem(category, index))
          .filter(Boolean);

        setForm({
          ...DEFAULT_FORM,

          storeName: storeData?.storeName || "",
          slug: storeData?.slug || "",
          phone: storeData?.phone || "",
          address: storeData?.address || "",
          businessType: privateData?.businessType || "",
          isActive: storeData?.isActive !== false,
          storeDescription:
            privateData?.storeDescription ||
            storeData?.storeDescription ||
            storeData?.description ||
            "",

          customDomain:
            storeData?.primaryDomain ||
            (Array.isArray(storeData?.customDomains)
              ? storeData.customDomains[0] || ""
              : ""),
          customDomainStatus: storeData?.customDomainStatus || "",

          storeLogo: privateData?.branding?.storeLogo || "",
          themeColor: privateData?.branding?.themeColor || "#128c7e",
          buttonColor: privateData?.branding?.buttonColor || "#128c7e",
          accentColor: privateData?.branding?.accentColor || "#25d366",
          fontStyle: privateData?.branding?.fontStyle || "inter",
          homepageLayout: privateData?.branding?.homepageLayout || "grid",
          productCardStyle:
            privateData?.branding?.productCardStyle || "standard",

          showOutOfStock:
            privateData?.showOutOfStock ??
            storeData?.catalogConfig?.showOutOfStock ??
            true,
          hideEmptyCategories:
            privateData?.catalogSettings?.hideEmptyCategories === true,
          defaultProductSort:
            privateData?.catalogSettings?.defaultProductSort || "manual",
          searchEnabled: privateData?.catalogSettings?.searchEnabled !== false,
          productFiltersEnabled:
            privateData?.catalogSettings?.productFiltersEnabled !== false,

          customCategories: savedCategories,

          minimumOrderAmount:
            privateData?.orderSettings?.minimumOrderAmount?.toString?.() || "",
          maximumOrderQuantity:
            privateData?.orderSettings?.maximumOrderQuantity?.toString?.() ||
            "",
          codLimitAmount:
            privateData?.orderSettings?.codLimitAmount?.toString?.() || "",

          deliveryCharge:
            privateData?.deliverySettings?.deliveryCharge?.toString?.() || "",
          freeDeliveryThreshold:
            privateData?.deliverySettings?.freeDeliveryThreshold?.toString?.() ||
            "",
          shippingNote: privateData?.deliverySettings?.shippingNote || "",

          razorpayEnabled: storeData?.paymentConfig?.razorpayEnabled === true,
          razorpayKeyId: storeData?.paymentConfig?.razorpayKeyId || "",
          razorpayKeySecret: privateData?.razorpayKeySecret || "",
          razorpayWebhookSecret: privateData?.razorpayWebhookSecret || "",
          razorpayMode: privateData?.razorpayMode || "test",
          codEnabled: privateData?.paymentMethods?.codEnabled !== false,
          bankTransferEnabled:
            privateData?.paymentMethods?.bankTransferEnabled === true,

          acceptOrdersNow:
            privateData?.storeTimings?.acceptOrdersNow ?? true,

          webhooks: {
            wh1: {
              ...DEFAULT_WEBHOOKS.wh1,
              ...(privateData?.webhooks?.wh1 || {}),
            },
            wh2: {
              ...DEFAULT_WEBHOOKS.wh2,
              ...(privateData?.webhooks?.wh2 || {}),
            },
            wh3: {
              ...DEFAULT_WEBHOOKS.wh3,
              ...(privateData?.webhooks?.wh3 || {}),
            },
          },
        });
      } catch (err) {
        console.error("Settings page load error:", err);
        setError(err?.message || "Failed to load store settings.");
      } finally {
        setLoading(false);
      }
    }

    loadStore();
  }, [user, authLoading]);

  function clearSectionMessage(sectionKey) {
    setSectionMessages((prev) => ({
      ...prev,
      [sectionKey]: null,
    }));
  }

  function setSectionSuccess(sectionKey, message) {
    setSectionMessages((prev) => ({
      ...prev,
      [sectionKey]: {
        type: "success",
        message,
      },
    }));
  }

  function setSectionError(sectionKey, message) {
    setSectionMessages((prev) => ({
      ...prev,
      [sectionKey]: {
        type: "error",
        message,
      },
    }));
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setError("");
    setCategoryError("");

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function setValue(name, value) {
    setError("");
    setCategoryError("");

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function setWebhookEnabled(key, enabled) {
    setError("");
    setCategoryError("");

    setForm((prev) => ({
      ...prev,
      webhooks: {
        ...prev.webhooks,
        [key]: {
          ...prev.webhooks[key],
          enabled,
        },
      },
    }));
  }

  function setWebhookCurl(key, curl) {
    setError("");
    setCategoryError("");

    setForm((prev) => ({
      ...prev,
      webhooks: {
        ...prev.webhooks,
        [key]: {
          ...prev.webhooks[key],
          curl,
        },
      },
    }));
  }

  async function handleImageUpload(e, field) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/svg+xml",
        "image/x-icon",
        "image/vnd.microsoft.icon",
      ];

      if (!allowedTypes.includes(file.type)) {
        setError("Please upload a valid image file.");
        return;
      }

      if (!user?.uid) {
        setError("Please log in again before uploading.");
        return;
      }

      if (!store?.id) {
        setError("Store information missing. Reload and try again.");
        return;
      }

      setError("");
      setCategoryError("");
      setUploadingField(field);

      const storage = getStorage();
      const extension =
        file.name.split(".").pop()?.toLowerCase() ||
        (file.type === "image/svg+xml" ? "svg" : "png");
      const safeName = `${field}-${Date.now()}.${extension}`;

      const storageRef = ref(storage, `stores/${store.id}/branding/${safeName}`);

      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      setForm((prev) => ({
        ...prev,
        [field]: downloadURL,
      }));

      setSectionSuccess(
        "branding",
        "Image uploaded. Click Save Branding to update settings."
      );
    } catch (err) {
      console.error("Image upload error:", err);
      setSectionError("branding", err?.message || "Failed to upload image.");
    } finally {
      setUploadingField("");

      if (e?.target) {
        e.target.value = null;
      }
    }
  }

  function removeImage(field) {
    setError("");
    setCategoryError("");

    setForm((prev) => ({
      ...prev,
      [field]: "",
    }));

    setSectionSuccess(
      "branding",
      "Image removed. Click Save Branding to update settings."
    );
  }

  function categoryExistsBySlug(slug, ignoreIndex = -1) {
    return form.customCategories.some((category, index) => {
      if (index === ignoreIndex) return false;

      const existingName = normalizeCategoryName(category?.name || "");
      const existingSlug = makeCategorySlug(existingName);

      return existingSlug && existingSlug === slug;
    });
  }

  function addCategory() {
    const name = normalizeCategoryName(newCategoryName);
    const icon = newCategoryIcon.trim() || "📦";
    const slug = makeCategorySlug(name);

    setCategoryError("");

    if (!name) {
      setCategoryError("Enter a category name.");
      return;
    }

    if (!slug) {
      setCategoryError("Enter a valid category name.");
      return;
    }

    if (categoryExistsBySlug(slug)) {
      setCategoryError(`Category "${name}" already exists.`);
      return;
    }

    setError("");
    setCategoryError("");

    setForm((prev) => ({
      ...prev,
      customCategories: [
        ...prev.customCategories,
        {
          id: slug,
          slug,
          name,
          icon,
        },
      ],
    }));

    setNewCategoryName("");
    setNewCategoryIcon("📦");
    clearSectionMessage("catalog");
  }

  function removeCategory(index) {
    setError("");
    setCategoryError("");

    setForm((prev) => ({
      ...prev,
      customCategories: prev.customCategories.filter((_, i) => i !== index),
    }));

    clearSectionMessage("catalog");
  }

  function moveCategory(index, direction) {
    setError("");
    setCategoryError("");

    setForm((prev) => {
      const next = [...prev.customCategories];
      const target = direction === "up" ? index - 1 : index + 1;

      if (target < 0 || target >= next.length) return prev;

      [next[index], next[target]] = [next[target], next[index]];

      return {
        ...prev,
        customCategories: next,
      };
    });

    clearSectionMessage("catalog");
  }

  function updateCategory(index, field, value) {
    setError("");
    setCategoryError("");

    if (field === "name") {
      const name = normalizeCategoryName(value);
      const slug = makeCategorySlug(name);

      if (slug && categoryExistsBySlug(slug, index)) {
        setCategoryError(`Category "${name}" already exists.`);
        return;
      }

      setForm((prev) => ({
        ...prev,
        customCategories: prev.customCategories.map((category, i) =>
          i === index
            ? {
                ...category,
                id: slug,
                slug,
                name,
              }
            : category
        ),
      }));

      clearSectionMessage("catalog");
      return;
    }

    setForm((prev) => ({
      ...prev,
      customCategories: prev.customCategories.map((category, i) =>
        i === index
          ? {
              ...category,
              [field]: value,
            }
          : category
      ),
    }));

    clearSectionMessage("catalog");
  }

  function validateCategoriesBeforeSave() {
    const seen = new Set();

    for (const category of form.customCategories) {
      const name = normalizeCategoryName(category?.name || "");
      const slug = makeCategorySlug(name);

      if (!name) continue;

      if (!slug) {
        setSectionError("catalog", `Invalid category name: "${name}".`);
        setCategoryError("");
        return false;
      }

      if (seen.has(slug)) {
        setSectionError("catalog", `Duplicate category found: "${name}".`);
        setCategoryError("");
        return false;
      }

      seen.add(slug);
    }

    return true;
  }

  function getCleanCommonValues() {
    return {
      cleanStoreName: form.storeName.trim(),
      cleanSlug: normalizeSlug(form.slug),
      cleanPhone: form.phone.trim(),
      cleanAddress: form.address.trim(),
      cleanKeyId: form.razorpayKeyId.trim(),
      cleanKeySecret: form.razorpayKeySecret.trim(),
      cleanWebhookSecret: form.razorpayWebhookSecret.trim(),
    };
  }

  async function validateBaseSave(sectionKey) {
    setError("");
    setCategoryError("");

    if (!user) {
      setError("Please log in again.");
      return false;
    }

    if (!store?.id) {
      setError("Store information missing.");
      return false;
    }

    if (sectionKey === "profile") {
      const { cleanStoreName, cleanSlug } = getCleanCommonValues();

      if (!cleanStoreName) {
        setSectionError("profile", "Store name is required.");
        return false;
      }

      if (!cleanSlug) {
        setSectionError("profile", "Store slug is required.");
        return false;
      }

      const storesRef = collection(db, "stores");
      const slugQuery = query(storesRef, where("slug", "==", cleanSlug));
      const slugSnap = await getDocs(slugQuery);

      if (!slugSnap.empty) {
        const conflictingDoc = slugSnap.docs.find((d) => d.id !== store.id);

        if (conflictingDoc) {
          setSectionError("profile", "This store slug is already taken.");
          return false;
        }
      }
    }

    if (sectionKey === "domain") {
      const cleanDomain = normalizeCustomDomain(form.customDomain);

      if (cleanDomain && !isValidDomain(cleanDomain)) {
        setSectionError("domain", "Enter a valid domain like shop.yourdomain.com.");
        return false;
      }

      if (cleanDomain && isReservedDomain(cleanDomain)) {
        setSectionError(
          "domain",
          "This domain is reserved and cannot be used as a custom store domain."
        );
        return false;
      }

      if (cleanDomain) {
        const storesRef = collection(db, "stores");
        const domainQuery = query(
          storesRef,
          where("customDomains", "array-contains", cleanDomain),
          limit(1)
        );

        const domainSnap = await getDocs(domainQuery);

        if (!domainSnap.empty) {
          const conflictingDoc = domainSnap.docs.find((d) => d.id !== store.id);

          if (conflictingDoc) {
            setSectionError(
              "domain",
              "This custom domain is already connected to another store."
            );
            return false;
          }
        }
      }
    }

    if (sectionKey === "catalog") {
      if (!validateCategoriesBeforeSave()) {
        return false;
      }
    }

    return true;
  }

  async function saveSection(sectionKey) {
    clearSectionMessage(sectionKey);

    const isValid = await validateBaseSave(sectionKey);
    if (!isValid) return;

    const {
      cleanStoreName,
      cleanSlug,
      cleanPhone,
      cleanAddress,
      cleanKeyId,
      cleanKeySecret,
      cleanWebhookSecret,
    } = getCleanCommonValues();

    const storeRef = doc(db, "stores", store.id);
    const privateRef = doc(db, "store_private", store.id);

    try {
      setSavingSection(sectionKey);

      if (sectionKey === "profile") {
        await updateDoc(storeRef, {
          ownerId: user.uid,
          storeName: cleanStoreName,
          slug: cleanSlug,
          phone: cleanPhone,
          address: cleanAddress,
          isActive: form.isActive,
          storeDescription: form.storeDescription.trim(),
          updatedAt: serverTimestamp(),
        });

        await setDoc(
          privateRef,
          {
            ownerId: user.uid,
            businessType: form.businessType.trim(),
            storeDescription: form.storeDescription.trim(),
            storeTimings: {
              acceptOrdersNow: form.acceptOrdersNow,
            },
          },
          { merge: true }
        );

        setStore((prev) =>
          prev
            ? {
                ...prev,
                storeName: cleanStoreName,
                slug: cleanSlug,
                phone: cleanPhone,
                address: cleanAddress,
                isActive: form.isActive,
                storeDescription: form.storeDescription.trim(),
              }
            : prev
        );

        setForm((prev) => ({
          ...prev,
          storeName: cleanStoreName,
          slug: cleanSlug,
          phone: cleanPhone,
          address: cleanAddress,
        }));
      }

      if (sectionKey === "domain") {
        const cleanDomain = normalizeCustomDomain(form.customDomain);

        await updateDoc(storeRef, {
          customDomains: cleanDomain ? [cleanDomain] : [],
          primaryDomain: cleanDomain,
          customDomainStatus: cleanDomain ? "pending" : "",
          updatedAt: serverTimestamp(),
        });

        setStore((prev) =>
          prev
            ? {
                ...prev,
                customDomains: cleanDomain ? [cleanDomain] : [],
                primaryDomain: cleanDomain,
                customDomainStatus: cleanDomain ? "pending" : "",
              }
            : prev
        );

        setForm((prev) => ({
          ...prev,
          customDomain: cleanDomain,
          customDomainStatus: cleanDomain ? "pending" : "",
        }));
      }

      if (sectionKey === "branding") {
        await setDoc(
          privateRef,
          {
            ownerId: user.uid,
            branding: {
              storeLogo: form.storeLogo.trim(),
              themeColor: form.themeColor,
              buttonColor: form.buttonColor,
              accentColor: form.accentColor,
              fontStyle: form.fontStyle,
              homepageLayout: form.homepageLayout,
              productCardStyle: form.productCardStyle,
            },
          },
          { merge: true }
        );
      }

      if (sectionKey === "catalog") {
        const normalizedCategories = form.customCategories
          .map((category, index) => normalizeCategoryItem(category, index))
          .filter(Boolean);

        await updateDoc(storeRef, {
          catalogConfig: {
            showOutOfStock: form.showOutOfStock,
            customCategories: normalizedCategories,
            defaultProductSort: form.defaultProductSort,
            searchEnabled: form.searchEnabled,
            productFiltersEnabled: form.productFiltersEnabled,
            hideEmptyCategories: form.hideEmptyCategories,
          },
          customCategories: normalizedCategories,
          updatedAt: serverTimestamp(),
        });

        await setDoc(
          privateRef,
          {
            ownerId: user.uid,
            showOutOfStock: form.showOutOfStock,
            customCategories: normalizedCategories,
            catalogSettings: {
              hideEmptyCategories: form.hideEmptyCategories,
              defaultProductSort: form.defaultProductSort,
              searchEnabled: form.searchEnabled,
              productFiltersEnabled: form.productFiltersEnabled,
            },
          },
          { merge: true }
        );

        setStore((prev) =>
          prev
            ? {
                ...prev,
                catalogConfig: {
                  ...(prev.catalogConfig || {}),
                  showOutOfStock: form.showOutOfStock,
                  customCategories: normalizedCategories,
                  defaultProductSort: form.defaultProductSort,
                  searchEnabled: form.searchEnabled,
                  productFiltersEnabled: form.productFiltersEnabled,
                  hideEmptyCategories: form.hideEmptyCategories,
                },
                customCategories: normalizedCategories,
              }
            : prev
        );

        setForm((prev) => ({
          ...prev,
          customCategories: normalizedCategories,
        }));
      }

      if (sectionKey === "order") {
        await setDoc(
          privateRef,
          {
            ownerId: user.uid,
            orderSettings: {
              minimumOrderAmount: toNumberOrZero(form.minimumOrderAmount),
              maximumOrderQuantity: toNumberOrZero(form.maximumOrderQuantity),
              codLimitAmount: toNumberOrZero(form.codLimitAmount),
            },
          },
          { merge: true }
        );
      }

      if (sectionKey === "delivery") {
        await setDoc(
          privateRef,
          {
            ownerId: user.uid,
            deliverySettings: {
              deliveryCharge: toNumberOrZero(form.deliveryCharge),
              freeDeliveryThreshold: toNumberOrZero(form.freeDeliveryThreshold),
              shippingNote: form.shippingNote.trim(),
            },
          },
          { merge: true }
        );
      }

      if (sectionKey === "payments") {
        await updateDoc(storeRef, {
          paymentConfig: {
            razorpayEnabled: form.razorpayEnabled,
            razorpayKeyId: cleanKeyId,
          },
          updatedAt: serverTimestamp(),
        });

        await setDoc(
          privateRef,
          {
            ownerId: user.uid,
            razorpayKeySecret: cleanKeySecret,
            razorpayWebhookSecret: cleanWebhookSecret,
            razorpayMode: form.razorpayMode,
            paymentMethods: {
              codEnabled: form.codEnabled,
              bankTransferEnabled: form.bankTransferEnabled,
            },
          },
          { merge: true }
        );

        setStore((prev) =>
          prev
            ? {
                ...prev,
                paymentConfig: {
                  razorpayEnabled: form.razorpayEnabled,
                  razorpayKeyId: cleanKeyId,
                },
              }
            : prev
        );
      }

      if (sectionKey === "webhooks") {
        await setDoc(
          privateRef,
          {
            ownerId: user.uid,
            webhooks: form.webhooks,
          },
          { merge: true }
        );
      }

      setPrivateDocExists(true);
      setSectionSuccess(sectionKey, "Section updated successfully.");
    } catch (err) {
      console.error("Save section error:", err);
      setSectionError(sectionKey, err?.message || "Failed to update section.");
    } finally {
      setSavingSection("");
    }
  }

  async function handleTestWebhook(key) {
    try {
      setError("");
      setCategoryError("");
      setTestingWebhookKey(key);

      const config = form.webhooks?.[key];

      if (!config?.enabled) {
        setSectionError("webhooks", "Enable the webhook before testing.");
        return;
      }

      if (!config?.curl || config.curl.trim().length < 10) {
        setSectionError("webhooks", "Invalid webhook cURL.");
        return;
      }

      const samplePayload = {
        order_id: "TEST-ORDER-1001",
        customer_name: "Test Customer",
        customer_phone: "9876543210",
        order_total: "499",
        order_status: key === "wh2" ? "completed" : "confirmed",
        store_name: form.storeName || "Test Store",
        store_phone: form.phone || "9876543210",
        triggered_at: new Date().toISOString(),
      };

      const response = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhookKey: key,
          curl: config.curl,
          samplePayload,
        }),
      });

      const result = await response.json();

      setWebhookTestResult((prev) => ({
        ...prev,
        [key]: result,
      }));

      if (!response.ok || !result?.success) {
        setSectionError("webhooks", result?.error || "Webhook test failed.");
        return;
      }

      setSectionSuccess("webhooks", `${config.title} test sent successfully.`);
    } catch (err) {
      console.error("Webhook test error:", err);
      setSectionError("webhooks", err?.message || "Failed to test webhook.");

      setWebhookTestResult((prev) => ({
        ...prev,
        [key]: {
          success: false,
          error: err?.message || "Unknown error",
        },
      }));
    } finally {
      setTestingWebhookKey("");
    }
  }

  const razorpayNote = useMemo(() => {
    const key = form.razorpayKeyId.trim();

    if (!key) {
      return {
        className: "border-amber-200 bg-amber-50 text-amber-700",
        text: "No Key ID entered. Razorpay will not appear at checkout.",
      };
    }

    if (key.startsWith("rzp_test_") && form.razorpayMode === "live") {
      return {
        className: "border-red-200 bg-red-50 text-red-700",
        text: "Key looks like a test key but mode is set to live.",
      };
    }

    if (key.startsWith("rzp_live_") && form.razorpayMode === "test") {
      return {
        className: "border-amber-200 bg-amber-50 text-amber-700",
        text: "Key looks like a live key but mode is set to test.",
      };
    }

    if (form.razorpayMode === "test") {
      return {
        className: "border-blue-200 bg-blue-50 text-blue-700",
        text: "Test mode active. No real payments will be charged.",
      };
    }

    return {
      className: "border-green-200 bg-green-50 text-green-700",
      text: "Live mode active. Real payments will be processed.",
    };
  }, [form.razorpayKeyId, form.razorpayMode]);

  function SectionActions({ sectionKey, label }) {
    const notice = sectionMessages?.[sectionKey];

    return (
      <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-end">
        <InlineSectionNotice type={notice?.type} message={notice?.message} />

        <SectionSaveButton
          onClick={() => saveSection(sectionKey)}
          loading={savingSection === sectionKey}
          label={label}
        />
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f5f7fb] to-[#eef4f2] text-gray-900 [color-scheme:light]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Settings
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage store settings for {store?.storeName || "your store"}.
          </p>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Store Status
            </p>
            <p
              className={`mt-2 text-xl font-bold ${
                form.isActive ? "text-[#128c7e]" : "text-red-500"
              }`}
            >
              {form.isActive ? "Live" : "Inactive"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Public store availability
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Razorpay
            </p>
            <p
              className={`mt-2 text-xl font-bold ${
                form.razorpayEnabled ? "text-[#128c7e]" : "text-gray-500"
              }`}
            >
              {form.razorpayEnabled ? "Enabled" : "Disabled"}
            </p>
            <p className="mt-1 text-xs text-gray-500">Online payment status</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Categories
            </p>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {form.customCategories.length}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Custom catalog categories
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Orders
            </p>
            <p
              className={`mt-2 text-xl font-bold ${
                form.acceptOrdersNow ? "text-[#128c7e]" : "text-red-500"
              }`}
            >
              {form.acceptOrdersNow ? "Accepting" : "Paused"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Current ordering status
            </p>
          </div>
        </div>

        {!privateDocExists ? (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Click on <strong>Save </strong> button to save the settings.
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-5">
          <SectionCard
            title="1. Store Profile"
            subtitle="Basic store identity and contact information"
            right={<SectionActions sectionKey="profile" label="Save Profile" />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Store Name">
                <Input
                  type="text"
                  name="storeName"
                  value={form.storeName}
                  onChange={handleChange}
                  placeholder="Enter store name"
                />
              </Field>

              <Field
                label="Store Slug"
                hint={`Public link: /${normalizeSlug(
                  form.slug || "your-store-slug"
                )}`}
              >
                <Input
                  type="text"
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  placeholder="enter-store-slug"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Phone">
                <Input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter store phone"
                />
              </Field>

              <Field label="Business Type">
                <Input
                  type="text"
                  name="businessType"
                  value={form.businessType}
                  onChange={handleChange}
                  placeholder="Retail / Grocery / Fashion"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Store Description">
                <Textarea
                  name="storeDescription"
                  value={form.storeDescription}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Tell customers about your store"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Address">
                <Textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Enter store address"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ToggleRow
                title="Store is Live"
                subtitle="Customers can browse and order"
                checked={form.isActive}
                onChange={(value) => setValue("isActive", value)}
              />

              <ToggleRow
                title="Accept Orders Now"
                subtitle="Temporarily pause incoming orders without hiding store"
                checked={form.acceptOrdersNow}
                onChange={(value) => setValue("acceptOrdersNow", value)}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="2. Custom Domain Setup"
            subtitle="Connect your own domain to this store"
            right={<SectionActions sectionKey="domain" label="Save Domain" />}
          >
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <p className="font-semibold">Current Store Link</p>
              <p className="mt-1 break-all font-bold">
                https://app.qartlo.com/{normalizeSlug(form.slug || "your-store-slug")}
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
              <Field
                label="Custom Domain"
                hint="Do not add https:// or http://. Example: shop.yourdomain.com"
              >
                <Input
                  type="text"
                  name="customDomain"
                  value={form.customDomain}
                  onChange={(e) => {
                    clearSectionMessage("domain");
                    setValue("customDomain", normalizeCustomDomain(e.target.value));
                  }}
                  placeholder="shop.yourdomain.com"
                />
              </Field>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Status
                </p>
                <p
                  className={`mt-2 text-lg font-bold ${
                    form.customDomainStatus === "connected"
                      ? "text-green-600"
                      : form.customDomainStatus === "pending"
                      ? "text-amber-600"
                      : "text-gray-500"
                  }`}
                >
                  {form.customDomainStatus === "connected"
                    ? "Connected"
                    : form.customDomainStatus === "pending"
                    ? "Pending"
                    : "Not Connected"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
              <h3 className="font-bold text-blue-950">How to connect your domain</h3>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="font-semibold">Step 1: Open your domain provider</p>
                  <p className="mt-1 text-blue-800">
                    Go to GoDaddy, Hostinger, Namecheap, Cloudflare, or wherever your domain was purchased.
                  </p>
                </div>

                <div>
                  <p className="font-semibold">Step 2: Open DNS settings</p>
                  <p className="mt-1 text-blue-800">
                    Find DNS Management, DNS Records, or Manage DNS.
                  </p>
                </div>

                <div>
                  <p className="font-semibold">Step 3: Add DNS record</p>

                  <div className="mt-2 overflow-hidden rounded-2xl border border-blue-100 bg-white">
                    <div className="grid grid-cols-3 border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold uppercase text-blue-700">
                      <span>Type</span>
                      <span>Name</span>
                      <span>Value</span>
                    </div>

                    <div className="grid grid-cols-3 px-4 py-3 text-xs text-gray-700">
                      <span className="font-semibold">CNAME</span>
                      <span>shop</span>
                      <span className="break-all">Firebase hosting target</span>
                    </div>

                    <div className="grid grid-cols-3 border-t border-blue-100 px-4 py-3 text-xs text-gray-700">
                      <span className="font-semibold">CNAME</span>
                      <span>www</span>
                      <span className="break-all">Firebase hosting target</span>
                    </div>

                    <div className="grid grid-cols-3 border-t border-blue-100 px-4 py-3 text-xs text-gray-700">
                      <span className="font-semibold">A</span>
                      <span>@</span>
                      <span className="break-all">Firebase provided IP records</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="font-semibold">Step 4: Save domain here</p>
                  <p className="mt-1 text-blue-800">
                    Enter only the domain name above and click Save Domain.
                  </p>
                </div>

                <div>
                  <p className="font-semibold">Step 5: Wait for verification</p>
                  <p className="mt-1 text-blue-800">
                    DNS updates can take a few minutes to 24 hours.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <p className="font-semibold">Correct</p>
                <p className="mt-1 font-mono text-xs">shop.yourdomain.com</p>
                <p className="mt-1 font-mono text-xs">www.yourdomain.com</p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">Wrong</p>
                <p className="mt-1 font-mono text-xs">https://shop.yourdomain.com/</p>
                <p className="mt-1 font-mono text-xs">app.qartlo.com</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="3. Branding & Appearance"
            subtitle="Visual identity for your storefront"
            right={<SectionActions sectionKey="branding" label="Save Branding" />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ImageUploadField
                label="Store Logo"
                value={form.storeLogo}
                onChange={(e) => handleImageUpload(e, "storeLogo")}
                onRemove={() => removeImage("storeLogo")}
                uploading={uploadingField === "storeLogo"}
                previewClassName="h-20 w-20"
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              <Field label="Theme Color">
                <Input
                  type="color"
                  name="themeColor"
                  value={form.themeColor}
                  onChange={handleChange}
                  className="h-12"
                />
              </Field>

              <Field label="Button Color">
                <Input
                  type="color"
                  name="buttonColor"
                  value={form.buttonColor}
                  onChange={handleChange}
                  className="h-12"
                />
              </Field>

              <Field label="Accent Color">
                <Input
                  type="color"
                  name="accentColor"
                  value={form.accentColor}
                  onChange={handleChange}
                  className="h-12"
                />
              </Field>

              <Field label="Font Style">
                <Select
                  name="fontStyle"
                  value={form.fontStyle}
                  onChange={handleChange}
                >
                  <option value="inter">Inter</option>
                  <option value="poppins">Poppins</option>
                  <option value="roboto">Roboto</option>
                  <option value="lato">Lato</option>
                </Select>
              </Field>

              <Field label="Homepage Layout">
                <Select
                  name="homepageLayout"
                  value={form.homepageLayout}
                  onChange={handleChange}
                >
                  <option value="grid">Grid</option>
                  <option value="list">List</option>
                  <option value="mixed">Mixed</option>
                </Select>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Product Card Style">
                <Select
                  name="productCardStyle"
                  value={form.productCardStyle}
                  onChange={handleChange}
                >
                  <option value="standard">Standard</option>
                  <option value="compact">Compact</option>
                  <option value="premium">Premium</option>
                </Select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="4. Catalog Settings"
            subtitle="Control categories, browsing and product listing behavior"
            right={
              <div className="flex flex-wrap items-center gap-3">
                <InlineSectionNotice
                  type={sectionMessages.catalog?.type}
                  message={sectionMessages.catalog?.message}
                />

                <div className="rounded-full bg-[#e8f5ee] px-3 py-1 text-xs font-semibold text-[#128c7e]">
                  {form.customCategories.length} categories
                </div>

                <SectionSaveButton
                  onClick={() => saveSection("catalog")}
                  loading={savingSection === "catalog"}
                  label="Save Catalog"
                />
              </div>
            }
          >
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <ToggleRow
                title="Show Out of Stock"
                subtitle="Display unavailable items in catalog"
                checked={form.showOutOfStock}
                onChange={(value) => setValue("showOutOfStock", value)}
              />

              <ToggleRow
                title="Hide Empty Categories"
                subtitle="Hide categories with no products"
                checked={form.hideEmptyCategories}
                onChange={(value) => setValue("hideEmptyCategories", value)}
              />

              <ToggleRow
                title="Search Enabled"
                subtitle="Allow customers to search products"
                checked={form.searchEnabled}
                onChange={(value) => setValue("searchEnabled", value)}
              />

              <ToggleRow
                title="Product Filters"
                subtitle="Show category/filter options"
                checked={form.productFiltersEnabled}
                onChange={(value) => setValue("productFiltersEnabled", value)}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Default Product Sort">
                <Select
                  name="defaultProductSort"
                  value={form.defaultProductSort}
                  onChange={handleChange}
                >
                  <option value="manual">Manual</option>
                  <option value="newest">Newest First</option>
                  <option value="price_low_high">Price: Low to High</option>
                  <option value="price_high_low">Price: High to Low</option>
                  <option value="name_az">Name: A to Z</option>
                </Select>
              </Field>
            </div>

            <div className="mt-6 space-y-3">
              {form.customCategories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
                  No categories added yet.
                </div>
              ) : (
                form.customCategories.map((category, index) => (
                  <div
                    key={`${category.id || category.slug || category.name}-${index}`}
                    className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-[72px_1fr_180px]"
                  >
                    <div className="flex items-center justify-center rounded-2xl bg-white text-2xl">
                      {category.icon || "📦"}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        type="text"
                        value={category.name}
                        onChange={(e) =>
                          updateCategory(index, "name", e.target.value)
                        }
                        placeholder="Category name"
                      />

                      <Input
                        type="text"
                        value={category.icon}
                        maxLength={2}
                        onChange={(e) =>
                          updateCategory(index, "icon", e.target.value)
                        }
                        placeholder="📦"
                        className="text-center text-lg"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveCategory(index, "up")}
                        className="rounded-2xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
                      >
                        Up
                      </button>

                      <button
                        type="button"
                        onClick={() => moveCategory(index, "down")}
                        className="rounded-2xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
                      >
                        Down
                      </button>

                      <button
                        type="button"
                        onClick={() => removeCategory(index)}
                        className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_90px_180px]">
              <Input
                type="text"
                value={newCategoryName}
                onChange={(e) => {
                  setCategoryError("");
                  setNewCategoryName(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCategory();
                  }
                }}
                placeholder="Category name"
              />

              <Input
                type="text"
                value={newCategoryIcon}
                onChange={(e) => {
                  setCategoryError("");
                  setNewCategoryIcon(e.target.value);
                }}
                maxLength={2}
                className="text-center text-lg"
              />

              <button
                type="button"
                onClick={addCategory}
                className="rounded-2xl bg-[#128c7e] px-5 py-3 text-sm font-semibold text-white"
              >
                Add Category
              </button>
            </div>

            {categoryError ? (
              <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
                {categoryError}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="5. Order & Checkout Settings"
            subtitle="Control checkout rules and order behavior"
            right={<SectionActions sectionKey="order" label="Save Order" />}
          >
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Minimum Order Amount">
                <Input
                  type="text"
                  name="minimumOrderAmount"
                  value={form.minimumOrderAmount}
                  onChange={handleChange}
                  placeholder="e.g. 199"
                />
              </Field>

              <Field label="Max Order Quantity">
                <Input
                  type="text"
                  name="maximumOrderQuantity"
                  value={form.maximumOrderQuantity}
                  onChange={handleChange}
                  placeholder="e.g. 10"
                />
              </Field>

              <Field label="COD Limit Amount">
                <Input
                  type="text"
                  name="codLimitAmount"
                  value={form.codLimitAmount}
                  onChange={handleChange}
                  placeholder="e.g. 1000"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="6. Delivery Settings"
            subtitle="Control delivery charge and notes"
            right={<SectionActions sectionKey="delivery" label="Save Delivery" />}
          >
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Delivery Charge">
                <Input
                  type="text"
                  name="deliveryCharge"
                  value={form.deliveryCharge}
                  onChange={handleChange}
                  placeholder="e.g. 40"
                />
              </Field>

              <Field label="Free Delivery Threshold">
                <Input
                  type="text"
                  name="freeDeliveryThreshold"
                  value={form.freeDeliveryThreshold}
                  onChange={handleChange}
                  placeholder="e.g. 499"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Shipping Note">
                <Textarea
                  name="shippingNote"
                  value={form.shippingNote}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Any delivery note shown to customer"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="7. Payments"
            subtitle="Configure online and offline payment methods"
            right={<SectionActions sectionKey="payments" label="Save Payments" />}
          >
            

            <div className="mt-4">
              <ToggleRow
                title="Enable Razorpay"
                subtitle="Accept UPI, cards, net banking and wallets"
                checked={form.razorpayEnabled}
                onChange={(value) => setValue("razorpayEnabled", value)}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px]">
              <Field label="Razorpay Key ID">
                <Input
                  type="text"
                  name="razorpayKeyId"
                  value={form.razorpayKeyId}
                  onChange={handleChange}
                  placeholder="rzp_test_xxxxx or rzp_live_xxxxx"
                  className="font-mono"
                />
              </Field>

              <Field label="Mode">
                <Select
                  name="razorpayMode"
                  value={form.razorpayMode}
                  onChange={handleChange}
                >
                  <option value="test">Test Mode</option>
                  <option value="live">Live Mode</option>
                </Select>
              </Field>
            </div>

            <div
              className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${razorpayNote.className}`}
            >
              {razorpayNote.text}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Razorpay Key Secret">
                <Input
                  type="password"
                  name="razorpayKeySecret"
                  value={form.razorpayKeySecret}
                  onChange={handleChange}
                  placeholder="Enter Razorpay secret"
                />
              </Field>

              <Field label="Razorpay Webhook Secret">
                <Input
                  type="password"
                  name="razorpayWebhookSecret"
                  value={form.razorpayWebhookSecret}
                  onChange={handleChange}
                  placeholder="Enter webhook secret"
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <ToggleRow
                title="Cash on Delivery"
                subtitle="Pay when order arrives"
                checked={form.codEnabled}
                onChange={(value) => setValue("codEnabled", value)}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="8. Notifications & Webhooks"
            subtitle="Customer and admin notification preferences"
            right={<SectionActions sectionKey="webhooks" label="Save Webhooks" />}
          >
            <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Paste cURL from Wylto, Interakt, Wati, AiSensy, Gupshup, 2Factor
              or similar providers. Use variables like {"{{order_id}}"},{" "}
              {"{{customer_name}}"}, {"{{customer_phone}}"},{" "}
              {"{{order_total}}"}, {"{{order_status}}"} and{" "}
              {"{{store_name}}"} inside URL, headers or body.
            </div>

            <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800">
              <p className="font-semibold">Sample variables you can use</p>
              <p className="mt-1 break-all">
                {`{{order_id}}, {{customer_name}}, {{customer_phone}}, {{order_total}}, {{order_status}}, {{store_name}}, {{store_phone}}, {{triggered_at}}`}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {Object.entries(form.webhooks).map(([key, config]) => (
                <div
                  key={key}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-3 bg-gradient-to-r from-gray-50 to-white px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {config.title}
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            config.enabled
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {config.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-gray-500">
                        {config.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500">
                        {config.enabled ? "On" : "Off"}
                      </span>

                      <ToggleSwitch
                        checked={config.enabled}
                        onChange={(value) => setWebhookEnabled(key, value)}
                      />

                      <button
                        type="button"
                        onClick={() => handleTestWebhook(key)}
                        disabled={
                          testingWebhookKey === key ||
                          !config.enabled ||
                          !config.curl?.trim()
                        }
                        className="rounded-xl border border-[#128c7e] px-3 py-2 text-xs font-semibold text-[#128c7e] transition hover:bg-[#128c7e] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {testingWebhookKey === key
                          ? "Testing..."
                          : "Test Webhook"}
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <Textarea
                      value={config.curl}
                      onChange={(e) => setWebhookCurl(key, e.target.value)}
                      rows={7}
                      placeholder="curl --request POST ..."
                      className="border border-gray-200 bg-gray-50 font-mono text-xs text-gray-900 focus:ring-2 focus:ring-[#128c7e]/20"
                    />

                    {webhookTestResult[key] ? (
                      <div
                        className={`mt-3 rounded-2xl border px-4 py-3 text-xs ${
                          webhookTestResult[key]?.success
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        <p className="font-semibold">
                          {webhookTestResult[key]?.success
                            ? "Test successful"
                            : "Test failed"}
                        </p>

                        {webhookTestResult[key]?.message ? (
                          <p className="mt-1">
                            {webhookTestResult[key].message}
                          </p>
                        ) : null}

                        {webhookTestResult[key]?.status ? (
                          <p className="mt-1">
                            HTTP Status: {webhookTestResult[key].status}
                          </p>
                        ) : null}

                        {webhookTestResult[key]?.responseText ? (
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-[11px] text-gray-900">
                            {webhookTestResult[key].responseText}
                          </pre>
                        ) : null}

                        {webhookTestResult[key]?.error ? (
                          <p className="mt-1">{webhookTestResult[key].error}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
