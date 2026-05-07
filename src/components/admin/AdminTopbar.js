"use client";

export default function AdminTopbar({
  activeTab,
  onChangeTab,
  storeName = "CatalogPro",
  onLogout,
}) {
  const tabs = [
    "dashboard",
    "products",
    "orders",
    "customers",
    "reports",
    "settings",
  ];

  const safeStoreName =
    typeof storeName === "string" && storeName.trim()
      ? storeName
      : "CatalogPro";

  return (
    <div className="sticky top-0 z-50 border-b border-[#0f7a70] bg-[#128c7e] text-white shadow-sm">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 md:px-6">
        
        {/* LEFT BRAND */}
        <div className="flex min-w-[140px] items-center gap-3">
          <h1 className="text-[17px] font-extrabold md:text-[18px]">
            ⚙ {safeStoreName}
          </h1>
        </div>

        {/* CENTER TABS */}
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onChangeTab?.(tab)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
                    isActive
                      ? "bg-white/20 text-white shadow-inner"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT LOGOUT */}
        <div className="flex min-w-[140px] items-center justify-end">
          <button
            type="button"
            onClick={() => onLogout?.()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#128c7e] transition hover:bg-white/90"
          >
            Logout
          </button>
        </div>
      </div>

      {/* MOBILE TABS */}
      <div className="overflow-x-auto px-4 pb-3 md:hidden">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => onChangeTab?.(tab)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                  isActive
                    ? "bg-white text-[#128c7e]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}