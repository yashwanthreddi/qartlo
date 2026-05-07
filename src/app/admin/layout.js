"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { getStoreByOwnerId } from "@/lib/firestore";
import Loader from "@/components/shared/Loader";
import AdminTopbar from "@/components/admin/AdminTopbar";

function getActiveTabFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();

  if (path.includes("/products")) return "products";
  if (path.includes("/orders")) return "orders";
  if (path.includes("/customers")) return "customers";
  if (path.includes("/reports")) return "reports";
  if (path.includes("/settings")) return "settings";
  return "dashboard";
}

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  const [storeChecked, setStoreChecked] = useState(false);
  const [store, setStore] = useState(null);

  const activeTab = useMemo(() => {
    return getActiveTabFromPath(pathname);
  }, [pathname]);

  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      if (loading) return;

      if (!user?.uid) {
        if (isMounted) {
          setStore(null);
          setStoreChecked(true);
        }
        router.replace("/login");
        return;
      }

      try {
        if (isMounted) {
          setStoreChecked(false);
        }

        const existingStore = await getStoreByOwnerId(user.uid);

        if (!isMounted) return;

        if (!existingStore) {
          setStore(null);
          setStoreChecked(true);
          router.replace("/create-store");
          return;
        }

        setStore(existingStore);
      } catch (error) {
        console.error("Admin store check error:", error);

        if (isMounted) {
          setStore(null);
        }
      } finally {
        if (isMounted) {
          setStoreChecked(true);
        }
      }
    }

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleChangeTab = (tab) => {
    if (tab === "dashboard") {
      if (pathname !== "/admin") {
        router.push("/admin");
      }
      return;
    }

    const targetPath = `/admin/${tab}`;
    if (pathname !== targetPath) {
      router.push(targetPath);
    }
  };

  if (loading || !storeChecked || !user) {
    return <Loader text="Loading admin panel..." />;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <AdminTopbar
        activeTab={activeTab}
        onChangeTab={handleChangeTab}
        storeName={store?.storeName || "My Store"}
        onLogout={handleLogout}
      />

      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
        <div className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}