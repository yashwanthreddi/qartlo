"use client";

function normalizeCategoryId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CategorySidebar({
  categories = [],
  selectedCategory = "all",
  onSelectCategory,
  themeColor = "#128c7e",
}) {
  const safeCategories = Array.isArray(categories) ? categories : [];

  const normalizedCategories = safeCategories
    .map((category, index) => {
      if (typeof category === "string") {
        const name = String(category || "").trim();
        const id = normalizeCategoryId(name) || `category-${index}`;

        return {
          id,
          name: name || "Category",
          icon: "📦",
          sortOrder: index,
        };
      }

      const rawId =
        category?.id || category?.slug || category?.name || `category-${index}`;

      const id = normalizeCategoryId(rawId) || `category-${index}`;

      return {
        id,
        name: String(category?.name || "Category").trim() || "Category",
        icon: String(category?.icon || "📦").trim() || "📦",
        sortOrder:
          typeof category?.sortOrder === "number" ? category.sortOrder : index,
      };
    })
    .filter((category) => category?.id && category?.name);

  const uniqueCategoriesMap = new Map();

  normalizedCategories.forEach((category) => {
    if (!uniqueCategoriesMap.has(category.id)) {
      uniqueCategoriesMap.set(category.id, category);
    }
  });

  const sortedCategories = Array.from(uniqueCategoriesMap.values()).sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );

  const safeSelectedCategory =
    typeof selectedCategory === "string" && selectedCategory.trim()
      ? selectedCategory
      : "all";

  const safeThemeColor =
    typeof themeColor === "string" && themeColor.trim()
      ? themeColor
      : "#128c7e";

  return (
    <aside className="h-full w-[88px] min-w-[88px] max-w-[88px] overflow-y-auto border-r border-gray-200 bg-[#f3f4f6]">
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => onSelectCategory?.("all")}
          className="group flex min-h-[84px] w-full flex-col items-center justify-center gap-1.5 border-l-[3px] px-2 py-3 text-center transition-all"
          style={
            safeSelectedCategory === "all"
              ? {
                  borderLeftColor: safeThemeColor,
                  backgroundColor: "#ffffff",
                  color: safeThemeColor,
                }
              : {
                  borderLeftColor: "transparent",
                }
          }
        >
          <span className="text-[20px] leading-none">🛍️</span>
          <span className="line-clamp-2 text-[10px] font-semibold leading-3">
            All
          </span>
        </button>

        {sortedCategories.map((category) => {
          const isActive = safeSelectedCategory === category.id;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectCategory?.(category.id)}
              className="group flex min-h-[84px] w-full flex-col items-center justify-center gap-1.5 border-l-[3px] px-2 py-3 text-center text-gray-500 transition-all hover:bg-white"
              style={
                isActive
                  ? {
                      borderLeftColor: safeThemeColor,
                      backgroundColor: "#ffffff",
                      color: safeThemeColor,
                    }
                  : {
                      borderLeftColor: "transparent",
                    }
              }
            >
              <span className="text-[20px] leading-none">
                {category.icon || "📦"}
              </span>
              <span className="line-clamp-2 text-[10px] font-semibold leading-3">
                {category.name}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}