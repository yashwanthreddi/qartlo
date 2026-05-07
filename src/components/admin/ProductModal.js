"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

const MAX_IMAGES = 4;

function normalizeCategoryId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ProductModal({
  open,
  onClose,
  onSave,
  product,
  categories = [],
  loading = false,
  storeId = "",
}) {
  const [form, setForm] = useState({
    name: "",
    category: "",
    price: "",
    stock: "",
    description: "",
    isActive: true,
    images: [],
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const normalizedCategories = useMemo(() => {
    const incoming = Array.isArray(categories) ? categories : [];

    const mapped = incoming
      .map((cat, index) => {
        if (typeof cat === "string") {
          const name = String(cat || "").trim();
          if (!name) return null;

          return {
            id: normalizeCategoryId(name) || `category-${index + 1}`,
            name,
            icon: "📦",
            sortOrder: index,
          };
        }

        const name = String(cat?.name || "").trim();
        if (!name) return null;

        return {
          id:
            normalizeCategoryId(cat?.id || cat?.name || "") ||
            `category-${index + 1}`,
          name,
          icon: String(cat?.icon || "").trim() || "📦",
          sortOrder:
            typeof cat?.sortOrder === "number" ? cat.sortOrder : index,
        };
      })
      .filter(Boolean);

    const uniqueMap = new Map();

    mapped.forEach((cat) => {
      if (!uniqueMap.has(cat.id)) {
        uniqueMap.set(cat.id, cat);
      }
    });

    return Array.from(uniqueMap.values()).sort(
      (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
    );
  }, [categories]);

  useEffect(() => {
    if (!open) return;

    const existingImages = Array.isArray(product?.images)
      ? product.images
          .map((img) => String(img || "").trim())
          .filter(Boolean)
          .slice(0, MAX_IMAGES)
      : product?.image
      ? [String(product.image).trim()]
      : [];

    const existingCategoryName = String(product?.category || "").trim();
    const matchingCategory = normalizedCategories.find(
      (cat) =>
        cat.name === existingCategoryName ||
        cat.id === normalizeCategoryId(existingCategoryName)
    );

    setForm({
      name: product?.name || "",
      category: matchingCategory?.name || "",
      price:
        product?.price !== undefined && product?.price !== null
          ? String(product.price)
          : "",
      stock:
        product?.stock !== undefined && product?.stock !== null
          ? String(product.stock)
          : "",
      description: product?.description || "",
      isActive:
        typeof product?.isActive === "boolean" ? product.isActive : true,
      images: existingImages,
    });

    setSelectedFiles([]);
    setPreviewImages(existingImages);
  }, [open, product, normalizedCategories]);

  useEffect(() => {
    return () => {
      previewImages.forEach((url) => {
        if (typeof url === "string" && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [previewImages]);

  if (!open) return null;

  const setField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);

    if (!files.length) return;

    const totalExisting = previewImages.length;
    const remainingSlots = MAX_IMAGES - totalExisting;

    if (remainingSlots <= 0) {
      alert(`You can upload only ${MAX_IMAGES} images.`);
      e.target.value = "";
      return;
    }

    const validFiles = files
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, remainingSlots);

    if (!validFiles.length) {
      alert("Please select valid image files.");
      e.target.value = "";
      return;
    }

    const newPreviews = validFiles.map((file) => URL.createObjectURL(file));

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setPreviewImages((prev) => [...prev, ...newPreviews]);

    e.target.value = "";
  };

  const handleRemoveImage = (index) => {
    if (index < form.images.length) {
      setForm((prev) => {
        const nextImages = prev.images.filter((_, i) => i !== index);
        return {
          ...prev,
          images: nextImages,
        };
      });

      setPreviewImages((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    const fileIndex = index - form.images.length;

    setSelectedFiles((prev) => prev.filter((_, i) => i !== fileIndex));

    setPreviewImages((prev) => {
      const removed = prev[index];

      if (typeof removed === "string" && removed.startsWith("blob:")) {
        URL.revokeObjectURL(removed);
      }

      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadSelectedImages = async () => {
    if (!selectedFiles.length) return [];

    const folderStoreId = storeId || product?.storeId;

    if (!folderStoreId) {
      throw new Error("storeId is missing for image upload");
    }

    const uploadedUrls = [];

    for (const file of selectedFiles) {
      const safeName = file.name.replace(/\s+/g, "_");
      const uniqueName = `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}_${safeName}`;

      const fileRef = ref(
        storage,
        `stores/${folderStoreId}/products/${uniqueName}`
      );

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      uploadedUrls.push(url);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!String(form.name).trim()) {
      alert("Product name is required.");
      return;
    }

    if (!String(form.category).trim()) {
      alert("Category is required.");
      return;
    }

    if (Number(form.price) < 0) {
      alert("Price cannot be negative.");
      return;
    }

    if (Number(form.stock) < 0) {
      alert("Stock cannot be negative.");
      return;
    }

    try {
      setUploading(true);

      const uploadedUrls = await uploadSelectedImages();

      const finalImages = [...form.images, ...uploadedUrls]
        .map((img) => String(img || "").trim())
        .filter(Boolean)
        .slice(0, MAX_IMAGES);

      const primaryImage = finalImages[0] || "";

      await onSave({
        name: String(form.name || "").trim(),
        category: String(form.category || "").trim(),
        categoryId: normalizeCategoryId(form.category || ""),
        price: Number(form.price || 0),
        stock: Number(form.stock || 0),
        description: String(form.description || "").trim(),
        isActive: Boolean(form.isActive),
        images: finalImages,
        image: primaryImage,
      });
    } catch (error) {
      console.error("Product image upload/save error:", error);
      alert("Failed to upload images or save product.");
    } finally {
      setUploading(false);
    }
  };

  const disabled = loading || uploading;
  const imageCount = previewImages.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {product?.id ? "Edit Product" : "Add Product"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Add product details and upload up to 4 images.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Product Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Enter product name"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#128c7e]"
                disabled={disabled}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Category
              </label>

              <select
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#128c7e]"
                disabled={disabled}
              >
                <option value="">Select category</option>

                {normalizedCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-gray-500">
                Categories are pulled from store settings.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Price
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setField("price", e.target.value)}
                placeholder="Enter price"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#128c7e]"
                disabled={disabled}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Stock
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => setField("stock", e.target.value)}
                placeholder="Enter stock quantity"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#128c7e]"
                disabled={disabled}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-3 rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setField("isActive", e.target.checked)}
                  disabled={disabled}
                />
                Active Product
              </label>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Description
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Enter product description"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#128c7e]"
              disabled={disabled}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700">
                Product Images
              </label>
              <span className="text-xs text-gray-500">
                {imageCount}/{MAX_IMAGES} selected
              </span>
            </div>

            <div className="rounded-[22px] border-2 border-dashed border-[#c8e6c9] bg-[#f0faf7] p-5">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                disabled={disabled || imageCount >= MAX_IMAGES}
                className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-full file:border-0 file:bg-[#128c7e] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />

              <p className="mt-3 text-xs text-gray-500">
                Upload up to 4 images. PNG, JPG, JPEG, WEBP supported.
              </p>

              {previewImages.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {previewImages.map((img, index) => (
                    <div
                      key={`${img}-${index}`}
                      className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white"
                    >
                      <img
                        src={img}
                        alt={`Preview ${index + 1}`}
                        className="h-28 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        disabled={disabled}
                        className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              className="rounded-full border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={disabled}
              className="rounded-full bg-[#128c7e] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading || uploading
                ? "Saving..."
                : product?.id
                ? "Update Product"
                : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}