"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import useAuth from "@/hooks/useAuth";
import {
  getStoreByOwnerId,
  getProductsByStoreId,
  deleteProduct,
  addProduct,
  updateProduct,
} from "@/lib/firestore";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import ProductTable from "@/components/admin/ProductTable";
import ProductModal from "@/components/admin/ProductModal";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeImageArray(product) {
  if (Array.isArray(product?.images)) {
    return product.images
      .map((img) => String(img || "").trim())
      .filter(Boolean)
      .slice(0, 4);
  }

  if (product?.image) {
    return [String(product.image).trim()];
  }

  return [];
}

function normalizeProduct(product) {
  const stockValue = Number(product?.stock ?? product?.availableStock ?? 0);
  const normalizedImages = normalizeImageArray(product);

  const name = String(product?.name || "").trim();
  const category = String(product?.category || "").trim() || "General";

  return {
    ...product,

    name,
    slug: String(product?.slug || slugify(name)).trim(),

    category,
    categorySlug: String(product?.categorySlug || slugify(category)).trim(),

    stock: Number.isFinite(stockValue) ? stockValue : 0,
    inStock:
      typeof product?.inStock === "boolean"
        ? product.inStock
        : Number.isFinite(stockValue)
        ? stockValue > 0
        : false,
    stockStatus:
      product?.stockStatus ||
      (Number(stockValue) > 0 ? "in_stock" : "out_of_stock"),

    images: normalizedImages,
    image: normalizedImages[0] || "",
  };
}

function normalizeCategoryItem(item) {
  if (typeof item === "string") {
    const name = item.trim();

    return {
      name,
      slug: slugify(name),
    };
  }

  const name = String(item?.name || "").trim();

  return {
    ...item,
    name,
    slug: String(item?.slug || slugify(name)).trim(),
  };
}

function getExcelCellValue(value) {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if (value.text !== undefined) {
      return String(value.text || "").trim();
    }

    if (value.result !== undefined) {
      return String(value.result || "").trim();
    }

    if (Array.isArray(value.richText)) {
      return value.richText
        .map((item) => String(item?.text || ""))
        .join("")
        .trim();
    }

    if (value.hyperlink) {
      return String(value.text || value.hyperlink || "").trim();
    }

    return String(value.toString ? value.toString() : "").trim();
  }

  return String(value).trim();
}

async function syncUploadedCategoriesToSettings(storeId, uploadedCategoryNames) {
  const privateRef = doc(db, "store_private", storeId);
  const privateSnap = await getDoc(privateRef);

  const privateData = privateSnap.exists() ? privateSnap.data() || {} : {};

  const existingCategories = Array.isArray(privateData?.customCategories)
    ? privateData.customCategories
        .map(normalizeCategoryItem)
        .filter((category) => category.name)
    : [];

  const categoryMap = new Map();

  existingCategories.forEach((category) => {
    categoryMap.set(category.slug, category);
  });

  uploadedCategoryNames.forEach((categoryName) => {
    const name = String(categoryName || "").trim();
    if (!name) return;

    const slug = slugify(name);

    if (!categoryMap.has(slug)) {
      categoryMap.set(slug, {
        name,
        slug,
      });
    }
  });

  const updatedCategories = Array.from(categoryMap.values());

  await setDoc(
    privateRef,
    {
      customCategories: updatedCategories,
    },
    { merge: true }
  );

  return updatedCategories;
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

async function parseUploadedFile(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      return [];
    }

    const headers = parseCsvLine(lines[0]).map((header) =>
      header.trim().replace(/^"|"$/g, "").toLowerCase()
    );

    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line).map((value) =>
        value.trim().replace(/^"|"$/g, "")
      );

      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      return row;
    });
  }

  if (fileName.endsWith(".xlsx")) {
    const arrayBuffer = await file.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return [];
    }

    const headerRow = worksheet.getRow(1);

    const headers = [];

    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = getExcelCellValue(cell.value)
        .trim()
        .replace(/^"|"$/g, "")
        .toLowerCase();

      headers[colNumber] = header;
    });

    const rows = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const normalizedRow = {};
      let hasValue = false;

      headers.forEach((header, colNumber) => {
        if (!header) return;

        const cell = row.getCell(colNumber);
        const value = getExcelCellValue(cell.value)
          .trim()
          .replace(/^"|"$/g, "");

        if (value) {
          hasValue = true;
        }

        normalizedRow[header] = value;
      });

      if (hasValue) {
        rows.push(normalizedRow);
      }
    });

    return rows;
  }

  throw new Error("Unsupported file type. Please upload CSV or XLSX file.");
}

export default function AdminProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef(null);

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (authLoading) return;

      if (!user?.uid) {
        if (isMounted) {
          setStore(null);
          setProducts([]);
          setCustomCategories([]);
          setLoading(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setLoading(true);
        }

        const storeData = await getStoreByOwnerId(user.uid);

        if (!isMounted) return;

        if (!storeData) {
          setStore(null);
          setProducts([]);
          setCustomCategories([]);
          return;
        }

        setStore(storeData);

        const storeProducts = await getProductsByStoreId(storeData.id);

        if (!isMounted) return;

        const normalizedProducts = Array.isArray(storeProducts)
          ? storeProducts.map((product) => normalizeProduct(product))
          : [];

        setProducts(normalizedProducts);

        const privateRef = doc(db, "store_private", storeData.id);
        const privateSnap = await getDoc(privateRef);

        if (!isMounted) return;

        if (privateSnap.exists()) {
          const privateData = privateSnap.data() || {};
          const savedCategories = Array.isArray(privateData?.customCategories)
            ? privateData.customCategories.map(normalizeCategoryItem)
            : [];

          setCustomCategories(savedCategories);
        } else {
          setCustomCategories([]);
        }
      } catch (err) {
        console.error("Products load error:", err);

        if (isMounted) {
          setStore(null);
          setProducts([]);
          setCustomCategories([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  const categories = useMemo(() => {
    const mapped = (Array.isArray(customCategories) ? customCategories : [])
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        return String(item?.name || "").trim();
      })
      .filter(Boolean);

    return [...new Set(mapped)];
  }, [customCategories]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const name = String(product?.name || "").toLowerCase();
      const category = String(product?.category || "").trim();
      const categoryLower = category.toLowerCase();

      const matchesSearch =
        !term || name.includes(term) || categoryLower.includes(term);

      const matchesCategory = !categoryFilter || category === categoryFilter;

      const stockValue = Number(product?.stock ?? product?.availableStock ?? 0);
      const inStock = stockValue > 0;

      const matchesStock =
        !stockFilter ||
        (stockFilter === "in" && inStock) ||
        (stockFilter === "out" && !inStock);

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, categoryFilter, stockFilter]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;

    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((product) => product.id !== id));
    } catch (err) {
      console.error("Delete product error:", err);
      alert("Failed to delete product");
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setOpenModal(true);
  };

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setOpenModal(true);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "name",
      "category",
      "price",
      "stock",
      "image",
      "image2",
      "image3",
      "image4",
      "description",
    ];

    const sampleRows = [
      [
        "Cotton T-Shirt",
        "Clothing",
        "299",
        "20",
        "https://example.com/tshirt-1.jpg",
        "https://example.com/tshirt-2.jpg",
        "",
        "",
        "Premium cotton t-shirt",
      ],
      [
        "Running Shoes",
        "Footwear",
        "1299",
        "0",
        "https://example.com/shoes-1.jpg",
        "",
        "",
        "",
        "Comfort running shoes",
      ],
    ];

    const csvContent = [headers, ...sampleRows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "products-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const handleUploadfile = () => {
    if (uploadLoading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file || !store?.id || !user?.uid) return;

    try {
      setUploadLoading(true);

      const rows = await parseUploadedFile(file);

      if (!Array.isArray(rows) || rows.length === 0) {
        alert("The file is empty or invalid.");
        return;
      }

      const createdProducts = [];
      const uploadedCategoryNames = new Set();

      for (const item of rows) {
        const productName = String(item?.name || "").trim();

        if (!productName) continue;

        const categoryName = String(item?.category || "").trim() || "General";
        const categorySlug = slugify(categoryName);

        uploadedCategoryNames.add(categoryName);

        const stockValue = Number(item?.stock || 0);
        const priceValue = Number(item?.price || 0);

        const imageUrl = String(item?.image || "").trim();
        const image2 = String(item?.image2 || "").trim();
        const image3 = String(item?.image3 || "").trim();
        const image4 = String(item?.image4 || "").trim();

        const normalizedImages = [imageUrl, image2, image3, image4]
          .map((image) => String(image || "").trim())
          .filter(Boolean)
          .slice(0, 4);

        const productPayload = normalizeProduct({
          ownerId: user.uid,
          storeId: store.id,

          name: productName,
          slug: slugify(productName),

          category: categoryName,
          categorySlug,

          price: Number.isFinite(priceValue) ? priceValue : 0,
          stock: Number.isFinite(stockValue) ? stockValue : 0,
          inStock: Number.isFinite(stockValue) ? stockValue > 0 : false,
          stockStatus:
            Number.isFinite(stockValue) && stockValue > 0
              ? "in_stock"
              : "out_of_stock",

          images: normalizedImages,
          image: normalizedImages[0] || "",

          description: String(item?.description || "").trim(),
          isActive: true,
        });

        const id = await addProduct(productPayload);

        createdProducts.push({
          id,
          ...productPayload,
        });
      }

      if (createdProducts.length === 0) {
        alert("No valid products found. Please check the file format.");
        return;
      }

      if (uploadedCategoryNames.size > 0) {
        const updatedCategories = await syncUploadedCategoriesToSettings(
          store.id,
          uploadedCategoryNames
        );

        setCustomCategories(updatedCategories);
      }

      setProducts((prev) => [...createdProducts, ...prev]);

      alert(
        `${createdProducts.length} products uploaded successfully. Categories and slugs updated.`
      );
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload file. Use CSV or XLSX format.");
    } finally {
      setUploadLoading(false);

      if (event?.target) {
        event.target.value = "";
      }
    }
  };

  const handleSaveProduct = async (payload) => {
    if (!store?.id || !user?.uid) return;

    try {
      setModalLoading(true);

      const stockValue = Number(payload?.stock || 0);

      const normalizedImages = Array.isArray(payload?.images)
        ? payload.images
            .map((img) => String(img || "").trim())
            .filter(Boolean)
            .slice(0, 4)
        : payload?.image
        ? [String(payload.image).trim()]
        : [];

      const productName = String(payload?.name || "").trim();
      const categoryName = String(payload?.category || "").trim() || "General";

      const normalizedPayload = normalizeProduct({
        ...payload,

        name: productName,
        slug: slugify(productName),

        category: categoryName,
        categorySlug: slugify(categoryName),

        price: Number(payload?.price || 0),
        stock: stockValue,
        inStock: stockValue > 0,
        stockStatus: stockValue > 0 ? "in_stock" : "out_of_stock",

        images: normalizedImages,
        image: normalizedImages[0] || "",

        description: String(payload?.description || "").trim(),
        isActive:
          typeof payload?.isActive === "boolean" ? payload.isActive : true,

        storeId: store.id,
        ownerId: user.uid,
      });

      const updatedCategories = await syncUploadedCategoriesToSettings(
        store.id,
        [categoryName]
      );

      setCustomCategories(updatedCategories);

      if (selectedProduct?.id) {
        await updateProduct(selectedProduct.id, normalizedPayload);

        setProducts((prev) =>
          prev.map((item) =>
            item.id === selectedProduct.id
              ? {
                  ...item,
                  ...normalizedPayload,
                }
              : item
          )
        );
      } else {
        const id = await addProduct(normalizedPayload);

        const newProduct = {
          id,
          ...normalizedPayload,
        };

        setProducts((prev) => [newProduct, ...prev]);
      }

      setOpenModal(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error("Save product error:", error);
      alert("Failed to save product");
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return <div className="p-2 text-sm text-gray-500">Loading products...</div>;
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Products ({filteredProducts.length})
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage products for {store?.storeName || "your store"}.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleUploadfile}
            disabled={uploadLoading}
            className="rounded-full bg-[#1d6f42] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadLoading ? "Uploading..." : "📄 Upload CSV/XLSX file"}
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
          >
            ⬇ Template
          </button>

          <button
            type="button"
            onClick={handleAddProduct}
            className="rounded-full bg-[#128c7e] px-5 py-2.5 text-sm font-semibold text-white"
          >
            + Add Product
          </button>
        </div>
      </div>

      <div
        onClick={handleUploadfile}
        className="cursor-pointer rounded-[22px] border-2 border-dashed border-[#c8e6c9] bg-[#f0faf7] px-6 py-14 text-center transition hover:bg-[#e8f5ee]"
      >
        <div className="text-5xl opacity-70">📄</div>

        <h3 className="mt-4 text-base font-semibold text-gray-900">
          Drag & drop CSV/XLSX file or click to upload
        </h3>

        <p className="mt-2 text-sm text-gray-500">
          Supports .csv and .xlsx files. Download the template to see the
          required format.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#128c7e]"
        />

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#128c7e] lg:w-[180px]"
        >
          <option value="">All Categories</option>

          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={stockFilter}
          onChange={(event) => setStockFilter(event.target.value)}
          className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#128c7e] lg:w-[150px]"
        >
          <option value="">All Stock</option>
          <option value="in">In Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm">
        <ProductTable
          products={filteredProducts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <ProductModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
          setSelectedProduct(null);
        }}
        onSave={handleSaveProduct}
        product={selectedProduct}
        categories={customCategories}
        loading={modalLoading}
        storeId={store?.id || ""}
      />
    </div>
  );
}