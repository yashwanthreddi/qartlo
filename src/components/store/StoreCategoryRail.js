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

function getSafeColor(color, fallback) {
  const value = String(color || "").trim();
  return value || fallback;
}

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;

  let clean = String(hex).replace("#", "").trim();

  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (clean.length !== 6) return `rgba(0, 0, 0, ${alpha})`;

  const num = Number.parseInt(clean, 16);

  if (Number.isNaN(num)) return `rgba(0, 0, 0, ${alpha})`;

  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function StoreCategoryRail({
  categories = [],
  active = "all",
  onSelect,
  themeColor = "#128c7e",

  // theme props
  backgroundColor = "#ffffff",
  textColor = "#111827",
  mutedTextColor = "#6b7280",
  activeTextColor = "#ffffff",
  borderColor = "#e5e7eb",
}) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeActive =
    typeof active === "string" && active.trim() ? active : "all";

  const safeThemeColor = getSafeColor(themeColor, "#128c7e");
  const safeBackgroundColor = getSafeColor(backgroundColor, "#ffffff");
  const safeTextColor = getSafeColor(textColor, "#111827");
  const safeMutedTextColor = getSafeColor(mutedTextColor, "#6b7280");
  const safeActiveTextColor = getSafeColor(activeTextColor, "#ffffff");
  const safeBorderColor = getSafeColor(borderColor, "#e5e7eb");

  const normalizedCategories = safeCategories
    .map((cat, index) => {
      if (typeof cat === "string") {
        const name = String(cat || "").trim();

        return {
          id: normalizeCategoryId(name) || `category-${index}`,
          name: name || "Category",
          icon: "📦",
        };
      }

      return {
        id:
          normalizeCategoryId(cat?.id || cat?.name || "") ||
          `category-${index}`,
        name: String(cat?.name || "Category").trim() || "Category",
        icon: String(cat?.icon || "📦").trim() || "📦",
      };
    })
    .filter((cat) => cat?.id && cat?.name);

  const uniqueCategoriesMap = new Map();

  normalizedCategories.forEach((cat) => {
    if (!uniqueCategoriesMap.has(cat.id)) {
      uniqueCategoriesMap.set(cat.id, cat);
    }
  });

  const uniqueCategories = Array.from(uniqueCategoriesMap.values());

  const getItemStyle = (isActive) => {
    if (isActive) {
      return {
        backgroundColor: safeThemeColor,
        color: safeActiveTextColor,
        boxShadow: `inset 3px 0 0 ${hexToRgba("#000000", 0.08)}`,
      };
    }

    return {
      backgroundColor: "transparent",
      color: safeMutedTextColor,
    };
  };

  return (
    <div
      className="h-[calc(100vh-60px)] w-24 overflow-y-auto border-r"
      style={{
        backgroundColor: safeBackgroundColor,
        borderColor: safeBorderColor,
      }}
    >
      <div
        onClick={() => onSelect?.("all")}
        className="cursor-pointer p-3 text-center text-xs transition"
        style={getItemStyle(safeActive === "all")}
      >
        <div
          className="mb-1 text-lg"
          style={{ color: safeActive === "all" ? safeActiveTextColor : safeTextColor }}
        >
          🛍️
        </div>
        <div
          className="break-words"
          style={{ color: safeActive === "all" ? safeActiveTextColor : safeMutedTextColor }}
        >
          All
        </div>
      </div>

      {uniqueCategories.map((cat) => {
        const isActive = safeActive === cat.id;

        return (
          <div
            key={cat.id}
            onClick={() => onSelect?.(cat.id)}
            className="cursor-pointer p-3 text-center text-xs transition"
            style={getItemStyle(isActive)}
          >
            <div
              className="mb-1 text-lg"
              style={{ color: isActive ? safeActiveTextColor : safeTextColor }}
            >
              {cat.icon}
            </div>
            <div
              className="break-words"
              style={{ color: isActive ? safeActiveTextColor : safeMutedTextColor }}
            >
              {cat.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}