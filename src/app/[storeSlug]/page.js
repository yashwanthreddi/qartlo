"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  getProductsByStoreId,
  getStoreBySlugOrDomain,
} from "@/lib/firestore";

import useCart from "@/hooks/useCart";

import StoreHeader from "@/components/store/StoreHeader";
import CategorySidebar from "@/components/store/CategorySidebar";
import ProductCard from "@/components/store/ProductCard";
import StoreProductListItem from "@/components/store/StoreProductListItem";
import StoreBottomCartBar from "@/components/store/StoreBottomCartBar";
import ProductDetailSheet from "@/components/store/ProductDetailSheet";

function normalizeCategoryId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getCreatedAtTime(value) {
  if (!value) return 0;

  if (typeof value?.seconds === "number") {
    return value.seconds;
  }

  if (typeof value?.toDate === "function") {
    return Math.floor(value.toDate().getTime() / 1000);
  }

  if (typeof value === "string" || value instanceof Date) {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : Math.floor(time / 1000);
  }

  return 0;
}

export default function StorePage() {
  const params = useParams();
  const router = useRouter();

  // This can be normal slug: ambica
  // Or custom domain from middleware: shop.ambica.com
  const storeSlug = params?.storeSlug;

  const { addToCart, updateQuantity, cartItems, cartTotal } = useCart();

  const [store, setStore] = useState(null);
  const [privateStore, setPrivateStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [priceFilter, setPriceFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        if (!storeSlug) {
          if (isMounted) {
            setStore(null);
            setPrivateStore(null);
            setProducts([]);
            setLoading(false);
          }
          return;
        }

        setLoading(true);

        const storeData = await getStoreBySlugOrDomain(storeSlug);

        if (!isMounted) return;

        if (!storeData) {
          setStore(null);
          setPrivateStore(null);
          setProducts([]);
          return;
        }

        setStore(storeData);

        try {
          const privateRes = await fetch(
            `/api/get-store-private?storeId=${encodeURIComponent(storeData.id)}`,
            { cache: "no-store" }
          );

          if (privateRes.ok) {
            const privateJson = await privateRes.json();

            if (isMounted) {
              setPrivateStore(privateJson?.data || null);
            }
          } else {
            if (isMounted) {
              setPrivateStore(null);
            }
          }
        } catch {
          if (isMounted) {
            setPrivateStore(null);
          }
        }

        let storeProducts = [];

        try {
          storeProducts = await getProductsByStoreId(storeData.id);
        } catch {
          storeProducts = [];
        }

        if (!isMounted) return;

        const normalizedProducts = (storeProducts || []).map(
          (product, index) => {
            const stockValue = Number(product?.stock ?? 0);
            const categoryValue =
              product?.categoryId || product?.category || "";

            return {
              ...product,
              stock: Number.isFinite(stockValue) ? stockValue : 0,
              inStock: Number.isFinite(stockValue) ? stockValue > 0 : false,
              images: Array.isArray(product?.images)
                ? product.images.filter(Boolean)
                : product?.image
                  ? [product.image]
                  : [],
              image:
                (Array.isArray(product?.images) && product.images[0]) ||
                product?.image ||
                "",
              categoryId: normalizeCategoryId(categoryValue) || "other",
              sortOrder:
                typeof product?.sortOrder === "number"
                  ? product.sortOrder
                  : index,
            };
          }
        );

        setProducts(normalizedProducts);
      } catch (error) {
        console.error("Store page load error:", error);

        if (isMounted) {
          setStore(null);
          setPrivateStore(null);
          setProducts([]);
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
  }, [storeSlug]);

  const branding = privateStore?.branding || store?.branding || {};

  const config = {
    ...(store?.catalogConfig || {}),
    ...(privateStore?.catalogSettings || {}),
    ...(privateStore || {}),
  };

  const storeTimings = privateStore?.storeTimings || {};

  useEffect(() => {
    let link = document.querySelector("link[rel='icon']");
    let created = false;
    let previousHref = "";

    if (link) {
      previousHref = link.href;
    }

    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
      created = true;
    }

    if (branding?.favicon) {
      link.href = branding.favicon;
    }

    return () => {
      if (created) {
        link.remove();
      } else if (previousHref) {
        link.href = previousHref;
      }
    };
  }, [branding?.favicon]);

  useEffect(() => {
    const font = branding?.fontStyle;
    if (!font) return;

    const fontLinks = {
      inter:
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      poppins:
        "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
      roboto:
        "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap",
      lato:
        "https://fonts.googleapis.com/css2?family=Lato:wght@400;500;600;700&display=swap",
    };

    let link = document.getElementById("dynamic-store-font");

    if (!link) {
      link = document.createElement("link");
      link.id = "dynamic-store-font";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    link.href = fontLinks[font] || fontLinks.inter;
  }, [branding?.fontStyle]);

  useEffect(() => {
    const font = branding?.fontStyle;

    const fontMap = {
      inter: "'Inter', sans-serif",
      poppins: "'Poppins', sans-serif",
      roboto: "'Roboto', sans-serif",
      lato: "'Lato', sans-serif",
    };

    const previousFont = document.body.style.fontFamily;
    document.body.style.fontFamily = fontMap[font] || "'Inter', sans-serif";

    return () => {
      document.body.style.fontFamily = previousFont;
    };
  }, [branding?.fontStyle]);

  const {
    showOutOfStock = true,
    hideEmptyCategories = false,
    searchEnabled = true,
    defaultProductSort = "manual",
  } = config || {};

  const productFiltersEnabled =
    config?.productFilters ?? config?.productFiltersEnabled ?? true;

  const themeColor = branding?.themeColor || "#128c7e";
  const buttonColor =
    branding?.buttonColor || branding?.accentColor || "#25d366";
  const homepageLayout = branding?.homepageLayout || "grid";
  const productCardStyle = branding?.productCardStyle || "standard";

  const isStoreClosed =
    store?.isActive === false ||
    storeTimings?.acceptOrdersNow === false ||
    storeTimings?.vacationMode === true ||
    storeTimings?.temporaryClosure === true;

  const visibleProducts = useMemo(() => {
    let result = [...products];

    if (!showOutOfStock) {
      result = result.filter((product) => Number(product?.stock || 0) > 0);
    }

    if (searchEnabled && searchTerm.trim()) {
      const searchQuery = searchTerm.trim().toLowerCase();

      result = result.filter((product) => {
        const name = String(product?.name || "").toLowerCase();
        const description = String(product?.description || "").toLowerCase();
        const category = String(product?.category || "").toLowerCase();

        return (
          name.includes(searchQuery) ||
          description.includes(searchQuery) ||
          category.includes(searchQuery)
        );
      });
    }

    if (selectedCategory !== "all") {
      result = result.filter(
        (product) =>
          normalizeCategoryId(product?.categoryId || product?.category) ===
          selectedCategory
      );
    }

    if (priceFilter) {
      result = result.filter((product) => {
        const price = Number(product?.price || 0);

        if (priceFilter === "0-500") return price <= 500;
        if (priceFilter === "500-1000") {
          return price >= 500 && price <= 1000;
        }
        if (priceFilter === "1000+") return price >= 1000;

        return true;
      });
    }

    if (defaultProductSort === "price_low_high") {
      result.sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
    } else if (defaultProductSort === "price_high_low") {
      result.sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
    } else if (defaultProductSort === "name_az") {
      result.sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""))
      );
    } else if (defaultProductSort === "newest") {
      result.sort(
        (a, b) =>
          getCreatedAtTime(b?.createdAt) - getCreatedAtTime(a?.createdAt)
      );
    } else {
      result.sort(
        (a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0)
      );
    }

    return result;
  }, [
    products,
    selectedCategory,
    searchTerm,
    showOutOfStock,
    searchEnabled,
    defaultProductSort,
    priceFilter,
  ]);

  const categoriesWithProducts = useMemo(() => {
    const sourceCategories =
      privateStore?.customCategories ||
      privateStore?.catalogSettings?.customCategories ||
      store?.catalogConfig?.customCategories ||
      store?.customCategories ||
      [];

    if (!hideEmptyCategories) {
      return sourceCategories;
    }

    const categoryIds = new Set(
      visibleProducts.map((product) =>
        normalizeCategoryId(product?.categoryId || product?.category || "")
      )
    );

    return sourceCategories.filter((category) => {
      const id =
        typeof category === "string"
          ? normalizeCategoryId(category)
          : normalizeCategoryId(category?.id || category?.name || "");

      return categoryIds.has(id);
    });
  }, [privateStore, store, visibleProducts, hideEmptyCategories]);

  const getQty = (productId) =>
    cartItems.find((item) => item.id === productId)?.quantity || 0;

  const handleAdd = (product, qty = 1) => {
    if (!product?.id) return;

    if (store?.isActive === false) {
      alert("Store is inactive");
      return;
    }

    if (
      storeTimings?.acceptOrdersNow === false ||
      storeTimings?.vacationMode === true ||
      storeTimings?.temporaryClosure === true
    ) {
      alert("Store is not accepting orders right now");
      return;
    }

    if (Number(product?.stock || 0) <= 0) {
      alert("Out of stock");
      return;
    }

    const currentQty = getQty(product.id);
    const targetQty = currentQty + qty;

    if (targetQty > Number(product?.stock || 0)) {
      alert(`Only ${product.stock} items remaining`);
      return;
    }

    if (qty === 1 && currentQty === 0) {
      addToCart(product, store, privateStore);
      return;
    }

    if (!privateStore && !store?.slug) {
      alert("Store information missing");
      return;
    }

    if (currentQty === 0) {
      addToCart(product, store, privateStore);
      return;
    }

    updateQuantity(product.id, targetQty);
  };

  const handleDecrease = (product) => {
    if (!product?.id) return;

    const currentQty = getQty(product.id);
    const nextQty = Math.max(currentQty - 1, 0);
    updateQuantity(product.id, nextQty);
  };

  const handleCartClick = () => {
    router.push("/cart");
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!store) {
    return <div className="p-6 text-red-500">Store not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <StoreHeader
        storeName={store?.storeName}
        storeDescription={
          privateStore?.storeDescription || store?.storeDescription || ""
        }
        storeLogo={branding?.storeLogo}
        themeColor={themeColor}
        cartCount={cartItems.length}
        onCartClick={handleCartClick}
      />

      <div className="px-3 pb-3 pt-3">
        {searchEnabled ? (
          <div className="mb-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search products"
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400"
            />
          </div>
        ) : null}

        {productFiltersEnabled ? (
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
            <div className="relative min-w-[160px]">
              <select
                value={priceFilter}
                onChange={(event) => setPriceFilter(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm font-medium text-gray-800 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              >
                <option value="">All Prices</option>
                <option value="0-500">₹0 - ₹500</option>
                <option value="500-1000">₹500 - ₹1000</option>
                <option value="1000+">₹1000+</option>
              </select>

              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {priceFilter ? (
              <button
                type="button"
                onClick={() => setPriceFilter("")}
                className="whitespace-nowrap rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
              >
                Clear Price
              </button>
            ) : null}
          </div>
        ) : null}

        {isStoreClosed ? (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This store is currently not accepting orders.
          </div>
        ) : null}
      </div>

      <div className="flex">
        {productFiltersEnabled ? (
          <CategorySidebar
            categories={categoriesWithProducts}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            themeColor={themeColor}
          />
        ) : null}

        <div
          className={`flex-1 pb-28 ${
            homepageLayout === "grid"
              ? "grid grid-cols-1 gap-3 px-3 md:grid-cols-2 lg:grid-cols-3"
              : homepageLayout === "mixed"
                ? "grid grid-cols-1 gap-3 px-3 md:grid-cols-2"
                : "flex flex-col"
          }`}
        >
          {visibleProducts.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-gray-500">
              No products found.
            </div>
          ) : homepageLayout === "grid" || homepageLayout === "mixed" ? (
            visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAdd}
                onClick={() => setSelectedProduct(product)}
                themeColor={themeColor}
                buttonColor={buttonColor}
                productCardStyle={productCardStyle}
              />
            ))
          ) : (
            visibleProducts.map((product) => (
              <StoreProductListItem
                key={product.id}
                product={product}
                quantity={getQty(product.id)}
                stock={product.stock}
                inStock={product.stock > 0}
                onAdd={handleAdd}
                onIncrease={handleAdd}
                onDecrease={handleDecrease}
                onClick={() => setSelectedProduct(product)}
                themeColor={themeColor}
                buttonColor={buttonColor}
                productCardStyle={productCardStyle}
              />
            ))
          )}
        </div>
      </div>

      <StoreBottomCartBar
        count={cartItems.length}
        total={cartTotal}
        onClick={handleCartClick}
        disabled={isStoreClosed}
        themeColor={buttonColor}
      />

      <ProductDetailSheet
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAdd={handleAdd}
        store={store}
        privateStore={privateStore}
      />
    </div>
  );
}