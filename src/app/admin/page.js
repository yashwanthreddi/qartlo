"use client";

import { useEffect, useMemo, useState } from "react";
import useAuth from "@/hooks/useAuth";
import {
  getStoreByOwnerId,
  getOrdersByStoreId,
  getProductsByStoreId,
} from "@/lib/firestore";

function DashboardStatCard({ label, value, accent = "text-gray-900" }) {
  return (
    <div className="rounded-[18px] border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[1px] text-gray-400">
        {label}
      </p>
      <p className={`mt-2 text-[22px] font-extrabold ${accent}`}>{value}</p>
    </div>
  );
}

function MiniCard({ title, icon, children }) {
  return (
    <div className="rounded-[20px] border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
        <span>{icon}</span>
        <span>{title}</span>
      </h3>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function getOrderTimestamp(order) {
  const createdAt = order?.createdAt;

  if (!createdAt) return 0;

  if (typeof createdAt?.seconds === "number") {
    return createdAt.seconds;
  }

  if (typeof createdAt?.toDate === "function") {
    return Math.floor(createdAt.toDate().getTime() / 1000);
  }

  if (typeof createdAt === "string") {
    const time = new Date(createdAt).getTime();
    return Number.isNaN(time) ? 0 : Math.floor(time / 1000);
  }

  if (createdAt instanceof Date) {
    const time = createdAt.getTime();
    return Number.isNaN(time) ? 0 : Math.floor(time / 1000);
  }

  return 0;
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (authLoading) return;

      if (!user?.uid) {
        if (isMounted) {
          setStore(null);
          setOrders([]);
          setProducts([]);
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
          setOrders([]);
          setProducts([]);
          return;
        }

        setStore(storeData);

        const [storeOrders, storeProducts] = await Promise.all([
          getOrdersByStoreId(storeData.id),
          getProductsByStoreId(storeData.id),
        ]);

        if (!isMounted) return;

        setOrders(Array.isArray(storeOrders) ? storeOrders : []);
        setProducts(Array.isArray(storeProducts) ? storeProducts : []);
      } catch (err) {
        console.error("Dashboard load error:", err);

        if (isMounted) {
          setStore(null);
          setOrders([]);
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
  }, [user, authLoading]);

  const dashboardData = useMemo(() => {
    const totalOrders = orders.length;
    const revenue = orders.reduce(
      (sum, order) => sum + Number(order?.totalAmount || 0),
      0
    );

    const paidOrders = orders.filter(
      (order) => String(order?.paymentStatus || "").toLowerCase() === "paid"
    ).length;

    const newOrders = orders.filter((order) =>
      ["new", "pending"].includes(
        String(order?.orderStatus || order?.status || "").toLowerCase()
      )
    ).length;

    const customerMap = new Map();
    const productMap = new Map();
    const categoryRevenueMap = new Map();

    orders.forEach((order) => {
      const customerName =
        order?.customer?.name || order?.customerName || "Customer";
      const customerPhone = order?.customer?.phone || order?.phone || "No phone";
      const customerKey = String(customerPhone || customerName).trim();

      if (!customerMap.has(customerKey)) {
        customerMap.set(customerKey, {
          name: customerName,
          phone: customerPhone,
          orders: 0,
          totalSpend: 0,
        });
      }

      const existingCustomer = customerMap.get(customerKey);
      existingCustomer.orders += 1;
      existingCustomer.totalSpend += Number(order?.totalAmount || 0);

      if (Array.isArray(order?.items)) {
        order.items.forEach((item) => {
          const productName = item?.name || "Unnamed Product";
          const category = item?.category || "Other";
          const qty = Number(item?.quantity || 0);
          const price = Number(item?.price || 0);
          const subtotal = qty * price;

          if (!productMap.has(productName)) {
            productMap.set(productName, {
              name: productName,
              units: 0,
            });
          }

          productMap.get(productName).units += qty;

          if (!categoryRevenueMap.has(category)) {
            categoryRevenueMap.set(category, 0);
          }

          categoryRevenueMap.set(
            category,
            categoryRevenueMap.get(category) + subtotal
          );
        });
      }
    });

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    const revenueByCategory = Array.from(categoryRevenueMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5);

    const recentOrders = [...orders]
      .sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a))
      .slice(0, 5);

    const avgOrder = totalOrders > 0 ? Math.round(revenue / totalOrders) : 0;

    return {
      totalOrders,
      revenue,
      paidOrders,
      newOrders,
      topProducts,
      revenueByCategory,
      topCustomers,
      recentOrders,
      avgOrder,
      customersCount: customerMap.size,
    };
  }, [orders]);

  const publicStoreLink = useMemo(() => {
    if (!store?.slug) return "";
    if (typeof window === "undefined") return `/${store.slug}`;
    return `${window.location.origin}/${store.slug}`;
  }, [store]);

  const copyStoreLink = async () => {
    if (!publicStoreLink) return;

    try {
      await navigator.clipboard.writeText(publicStoreLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  if (loading) {
    return <div className="p-2 text-sm text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <DashboardStatCard label="Products" value={products.length} />
        <DashboardStatCard
          label="Total Orders"
          value={dashboardData.totalOrders}
        />
        <DashboardStatCard
          label="New Orders"
          value={dashboardData.newOrders}
          accent="text-[#f46b2c]"
        />
        <DashboardStatCard
          label="Revenue"
          value={`₹${dashboardData.revenue.toLocaleString("en-IN")}`}
          accent="text-[#128c7e]"
        />
        <DashboardStatCard
          label="Customers"
          value={dashboardData.customersCount}
          accent="text-[#1565c0]"
        />
        <DashboardStatCard
          label="Avg Order"
          value={`₹${dashboardData.avgOrder.toLocaleString("en-IN")}`}
        />
      </div>

      <div className="rounded-[20px] border border-green-200 bg-[#edf8f0] px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-700">Store Link</p>
            <p className="mt-1 break-all text-[15px] font-semibold text-[#2f7d32]">
              {publicStoreLink || "Store link unavailable"}
            </p>
          </div>

          <button
            type="button"
            onClick={copyStoreLink}
            className="rounded-full bg-[#128c7e] px-5 py-2 text-sm font-bold text-white"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <MiniCard title="Top Products by Orders" icon="📊">
          {dashboardData.topProducts.length === 0 ? (
            <p className="text-sm text-gray-500">No product order data yet.</p>
          ) : (
            <div className="space-y-4">
              {dashboardData.topProducts.map((item) => {
                const maxUnits = dashboardData.topProducts[0]?.units || 1;
                const width = `${Math.max((item.units / maxUnits) * 100, 12)}%`;

                return (
                  <div key={item.name}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="truncate text-sm text-gray-700">{item.name}</p>
                      <p className="whitespace-nowrap text-sm text-gray-500">
                        {item.units} units
                      </p>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#128c7e]"
                        style={{ width }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </MiniCard>

        <MiniCard title="Revenue by Category" icon="📉">
          {dashboardData.revenueByCategory.length === 0 ? (
            <p className="text-sm text-gray-500">No category revenue yet.</p>
          ) : (
            <div className="space-y-4">
              {dashboardData.revenueByCategory.map((item) => {
                const maxAmount =
                  dashboardData.revenueByCategory[0]?.amount || 1;
                const width = `${Math.max((item.amount / maxAmount) * 100, 12)}%`;

                return (
                  <div key={item.category}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="truncate text-sm text-gray-700">
                        {item.category}
                      </p>
                      <p className="whitespace-nowrap text-sm text-gray-500">
                        ₹{Number(item.amount || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#128c7e]"
                        style={{ width }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </MiniCard>

        <MiniCard title="Recent Orders" icon="📋">
          {dashboardData.recentOrders.length === 0 ? (
            <p className="text-sm text-gray-500">No recent orders yet.</p>
          ) : (
            <div className="space-y-4">
              {dashboardData.recentOrders.map((order) => {
                const customerName =
                  order?.customer?.name || order?.customerName || "Customer";

                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {String(order?.id || "").slice(0, 10)} {customerName}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-sm font-bold text-[#128c7e]">
                      ₹{Number(order?.totalAmount || 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </MiniCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <MiniCard title="Top Customers" icon="👥">
          {dashboardData.topCustomers.length === 0 ? (
            <p className="text-sm text-gray-500">No customer data yet.</p>
          ) : (
            <div className="space-y-4">
              {dashboardData.topCustomers.map((customer) => (
                <div
                  key={`${customer.phone}-${customer.name}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {customer.name}
                    </p>
                    <p className="truncate text-sm text-[#128c7e]">
                      {customer.phone}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-[#128c7e]">
                      ₹{Number(customer.totalSpend || 0).toLocaleString("en-IN")}
                    </p>
                    <p className="text-sm text-gray-400">
                      {customer.orders} orders
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </MiniCard>
      </div>
    </div>
  );
}