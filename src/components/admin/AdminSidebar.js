"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "Products", href: "/admin/products" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Settings", href: "/admin/settings" },
];

function isRouteActive(pathname, href) {
  const currentPath = String(pathname || "");

  if (href === "/admin") {
    return currentPath === "/admin";
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export default function AdminSidebar({ user, store, onLogout }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white p-5 flex flex-col justify-between">
      <div>
        <h2 className="text-2xl font-bold mb-2">Admin Panel</h2>
        <p className="text-xs text-gray-400 mb-6 break-all">
          {store?.storeName || "My Store"}
        </p>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = isRouteActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-4 py-3 transition ${
                  isActive
                    ? "bg-white text-black font-semibold"
                    : "hover:bg-gray-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <p className="text-sm text-gray-300 mb-2 break-all">
          {user?.email || ""}
        </p>

        {store?.slug ? (
          <p className="text-xs text-gray-400 mb-3 break-all">
            Public link: /{store.slug}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => onLogout?.()}
          className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:opacity-90"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}