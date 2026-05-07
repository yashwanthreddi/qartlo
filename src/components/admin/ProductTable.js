"use client";

export default function ProductTable({ products = [], onEdit, onDelete }) {
  const getStockValue = (product) => {
    const value = Number(product?.stock ?? product?.availableStock ?? 0);
    return Number.isFinite(value) ? value : 0;
  };

  const isInStock = (product) => {
    return getStockValue(product) > 0;
  };

  const isLowStock = (product) => {
    const stock = getStockValue(product);
    return stock > 0 && stock <= 5;
  };

  const getProductImage = (product) => {
    if (Array.isArray(product?.images) && product.images.length > 0) {
      return product.images[0];
    }
    if (product?.image) {
      return product.image;
    }
    return null;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full">
        {/* HEADER */}
        <thead>
          <tr className="bg-[#fafafa] border-b border-gray-200">
            <th className="px-5 py-4 text-[11px] font-bold uppercase text-gray-400">
              Photo
            </th>
            <th className="px-5 py-4 text-[11px] font-bold uppercase text-gray-400">
              Product
            </th>
            <th className="px-5 py-4 text-[11px] font-bold uppercase text-gray-400">
              Category
            </th>
            <th className="px-5 py-4 text-[11px] font-bold uppercase text-gray-400">
              Price
            </th>
            <th className="px-5 py-4 text-[11px] font-bold uppercase text-gray-400">
              Stock
            </th>
            <th className="px-5 py-4 text-[11px] font-bold uppercase text-gray-400">
              Status
            </th>
            <th className="px-5 py-4 text-[11px] font-bold uppercase text-gray-400 text-right">
              Actions
            </th>
          </tr>
        </thead>

        {/* BODY */}
        <tbody>
          {!Array.isArray(products) || products.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-5 py-14 text-center text-sm text-gray-500"
              >
                No products found
              </td>
            </tr>
          ) : (
            products.map((product, index) => {
              const stockValue = getStockValue(product);
              const inStock = isInStock(product);
              const lowStock = isLowStock(product);
              const price = Number(product?.price || 0);
              const safePrice = Number.isFinite(price) ? price : 0;
              const imageUrl = getProductImage(product);

              return (
                <tr
                  key={product?.id || `product-${index}`}
                  className={`border-b border-gray-100 transition ${
                    !inStock
                      ? "bg-red-50 hover:bg-red-100"
                      : "hover:bg-[#fafafa]"
                  }`}
                >
                  {/* IMAGE */}
                  <td className="px-5 py-4">
                    <div className="h-[52px] w-[52px] rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product?.name || "Product"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xl opacity-30">🖼️</span>
                      )}
                    </div>
                  </td>

                  {/* PRODUCT */}
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-[15px] font-semibold text-gray-900">
                        {product?.name || "Unnamed"}
                      </p>
                      
                    </div>
                  </td>

                  {/* CATEGORY */}
                  <td className="px-5 py-4">
                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-[#eef7f2] text-[#128c7e]">
                      {product?.category || "General"}
                    </span>
                  </td>

                  {/* PRICE */}
                  <td className="px-5 py-4">
                    <span className="font-semibold text-gray-900">
                      ₹{safePrice.toLocaleString("en-IN")}
                    </span>
                  </td>

                  {/* STOCK */}
                  <td className="px-5 py-4">
                    <span
                      className={`font-semibold ${
                        stockValue === 0
                          ? "text-red-600"
                          : lowStock
                          ? "text-orange-500"
                          : "text-gray-800"
                      }`}
                    >
                      {stockValue}
                    </span>

                    {lowStock && (
                      <div className="text-xs text-orange-500 mt-1">
                        Low stock
                      </div>
                    )}
                  </td>

                  {/* STATUS */}
                  <td className="px-5 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        inStock
                          ? "bg-[#e8f5e9] text-[#2e7d32]"
                          : "bg-[#fdecea] text-[#c62828]"
                      }`}
                    >
                      {inStock ? "In Stock" : "Out of Stock"}
                    </span>
                  </td>

                  {/* ACTIONS */}
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit?.(product)}
                        className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition"
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete?.(product?.id)}
                        className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-red-100 transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}