"use client";

import { useRouter } from "next/navigation";

function formatMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toLocaleString("en-IN") : "0";
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

export default function StoreBottomCartBar({
  count = 0,
  total = 0,
  onClick,
  disabled = false,
  disabledMessage = "Store is not accepting orders",
  themeColor = "#25d366",
  buttonText = "View Cart →",

  // added theme props
  pageBackgroundColor = "#ffffff",
  textColor = "#ffffff",
  buttonBackgroundColor = "#ffffff",
  buttonTextColor,
  borderColor = "rgba(0,0,0,0.08)",
}) {
  const router = useRouter();

  const safeCount = Number(count || 0);
  const safeTotal = Number(total || 0);

  if (!Number.isFinite(safeCount) || safeCount <= 0) return null;

  const barColor = getSafeColor(themeColor, "#25d366");
  const safePageBg = getSafeColor(pageBackgroundColor, "#ffffff");
  const safeTextColor = getSafeColor(textColor, "#ffffff");
  const safeButtonBg = getSafeColor(buttonBackgroundColor, "#ffffff");
  const safeBorderColor = getSafeColor(borderColor, "rgba(0,0,0,0.08)");

  const safeButtonTextColor = getSafeColor(
    buttonTextColor,
    barColor
  );

  const safeDisabledMessage =
    typeof disabledMessage === "string" && disabledMessage.trim()
      ? disabledMessage
      : "Store is not accepting orders";

  const safeButtonText =
    typeof buttonText === "string" && buttonText.trim()
      ? buttonText
      : "View Cart →";

  const handleClick = () => {
    if (disabled) {
      alert(safeDisabledMessage);
      return;
    }

    if (typeof onClick === "function") {
      onClick();
      return;
    }

    router.push("/cart");
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-2"
      style={{
        background: `linear-gradient(to top, ${safePageBg} 65%, transparent)`,
      }}
    >
      <div
        onClick={handleClick}
        className={`flex items-center justify-between rounded-2xl px-4 py-3 shadow-lg transition ${
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
        }`}
        style={{
          backgroundColor: barColor,
          border: `1px solid ${safeBorderColor}`,
          boxShadow: `0 10px 25px ${hexToRgba(barColor, 0.22)}`,
        }}
      >
        <div style={{ color: safeTextColor }}>
          <p className="text-[14px] font-semibold">
            {safeCount} item{safeCount > 1 ? "s" : ""}
          </p>
          <span className="text-[12px] opacity-90">
            ₹{formatMoney(safeTotal)}
          </span>
        </div>

        <button
          type="button"
          disabled={disabled}
          className="rounded-full px-4 py-2 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
          style={{
            backgroundColor: safeButtonBg,
            color: safeButtonTextColor,
            border: `1px solid ${hexToRgba(safeButtonTextColor, 0.14)}`,
          }}
        >
          {disabled ? "Unavailable" : safeButtonText}
        </button>
      </div>
    </div>
  );
}