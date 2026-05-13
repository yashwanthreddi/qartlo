"use client";

import { useEffect, useMemo, useState } from "react";
import useAuth from "@/hooks/useAuth";
import {
  getOrdersByStoreId,
  getProductsByStoreId,
  getStoreByOwnerId,
} from "@/lib/firestore";

function ReportCard({ title, icon, children }) {
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

function ProgressList({ items, valueKey, labelKey, formatValue }) {
  if (!items.length) {
    return <p className="text-sm text-gray-500">No data available.</p>;
  }

  const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const value = Number(item[valueKey] || 0);
        const width = `${Math.max((value / max) * 100, 10)}%`;

        return (
          <div key={`${item[labelKey]}-${index}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="truncate text-sm text-gray-700">
                {item[labelKey]}
              </p>
              <p className="whitespace-nowrap text-sm text-gray-500">
                {formatValue ? formatValue(value, item) : value}
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

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function getCustomerName(order) {
  return (
    order?.customer?.name ||
    order?.customerName ||
    order?.name ||
    "Customer"
  );
}

function getCustomerPhone(order) {
  return (
    order?.customer?.phone ||
    order?.customerPhone ||
    order?.phone ||
    ""
  );
}

function getOrderAmount(order) {
  return Number(order?.totalAmount ?? order?.amount ?? order?.total ?? 0);
}

export default function AdminReportsPage() {
  const { user, loading: authLoading } = useAuth();

  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          setError("");
        }

        const storeData = await getStoreByOwnerId(user.uid);

        if (!isMounted) return;

        if (!storeData) {
          setError("No store found for this account.");
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
        console.error("Reports page load error:", err);

        if (isMounted) {
          setError("Failed to load reports.");
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

  const report = useMemo(() => {
    const totalRevenue = orders.reduce(
      (sum, order) => sum + getOrderAmount(order),
      0
    );

    const totalOrders = orders.length;
    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p?.isActive !== false).length;

    const customerMap = new Map();
    const topProductsMap = new Map();
    const categoryRevenueMap = new Map();
    const monthlySalesMap = new Map();

    orders.forEach((order) => {
      const customerName = getCustomerName(order);
      const customerPhone = getCustomerPhone(order);
      const normalizedPhone = normalizePhone(customerPhone);
      const fallbackKey = String(customerName || "").trim().toLowerCase();
      const customerKey = normalizedPhone || fallbackKey;

      if (customerKey) {
        if (!customerMap.has(customerKey)) {
          customerMap.set(customerKey, {
            name: customerName,
            phone: customerPhone || "-",
            spend: 0,
            orders: 0,
            lastOrderAt: 0,
          });
        }

        const customer = customerMap.get(customerKey);
        const orderAmount = getOrderAmount(order);
        const orderTime = getOrderTimestamp(order);

        customer.spend += orderAmount;
        customer.orders += 1;

        if (orderTime >= Number(customer.lastOrderAt || 0)) {
          customer.lastOrderAt = orderTime;
          customer.name = customerName || customer.name;
          customer.phone = customerPhone || customer.phone;
        }
      }

      if (Array.isArray(order?.items)) {
        order.items.forEach((item) => {
          const productKey = item?.id || item?.name || "Unnamed Product";
          const quantity = Number(item?.quantity || 0);
          const revenue = quantity * Number(item?.price || 0);
          const category = item?.category || "Other";

          if (!topProductsMap.has(productKey)) {
            topProductsMap.set(productKey, {
              name: item?.name || "Unnamed Product",
              quantity: 0,
              revenue: 0,
            });
          }

          topProductsMap.get(productKey).quantity += quantity;
          topProductsMap.get(productKey).revenue += revenue;

          if (!categoryRevenueMap.has(category)) {
            categoryRevenueMap.set(category, 0);
          }

          categoryRevenueMap.set(
            category,
            categoryRevenueMap.get(category) + revenue
          );
        });
      }

      const seconds = getOrderTimestamp(order);

      if (seconds) {
        const date = new Date(seconds * 1000);
        const key = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!monthlySalesMap.has(key)) {
          monthlySalesMap.set(key, {
            month: key,
            revenue: 0,
            orders: 0,
          });
        }

        monthlySalesMap.get(key).revenue += getOrderAmount(order);
        monthlySalesMap.get(key).orders += 1;
      }
    });

    const totalCustomers = customerMap.size;
    const averageOrderValue =
      totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const topProducts = Array.from(topProductsMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const revenueByCategory = Array.from(categoryRevenueMap.entries())
      .map(([category, revenue]) => ({
        category,
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const monthlySales = Array.from(monthlySalesMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    const allCustomers = Array.from(customerMap.values()).sort(
      (a, b) => b.spend - a.spend
    );

    const topCustomers = allCustomers.slice(0, 5);

    return {
      totalRevenue,
      totalOrders,
      totalProducts,
      activeProducts,
      totalCustomers,
      averageOrderValue,
      topProducts,
      revenueByCategory,
      monthlySales,
      topCustomers,
      allCustomers,
    };
  }, [orders, products]);

  const exportCsv = (filename, headers, rows) => {
    if (!rows.length) {
      alert("No data available to export.");
      return;
    }

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const exportOrders = () => {
    exportCsv(
      "orders.csv",
      [
        "Order ID",
        "Customer",
        "Phone",
        "Amount",
        "Payment Status",
        "Order Status",
      ],
      orders.map((order) => [
        order?.id || "",
        getCustomerName(order),
        getCustomerPhone(order),
        getOrderAmount(order),
        order?.paymentStatus || "",
        order?.orderStatus || order?.status || "",
      ])
    );
  };

  const exportProducts = () => {
    exportCsv(
      "products.csv",
      ["Product", "Category", "Price", "Stock", "Status"],
      products.map((product) => [
        product?.name || "",
        product?.category || "",
        product?.price || 0,
        product?.stock ?? product?.availableStock ?? 0,
        product?.isActive !== false ? "Active" : "Inactive",
      ])
    );
  };

  const exportCustomers = () => {
    exportCsv(
      "customers.csv",
      ["Customer", "Phone", "Total Spend", "Orders"],
      report.allCustomers.map((customer) => [
        customer?.name || "",
        customer?.phone || "",
        customer?.spend || 0,
        customer?.orders || 0,
      ])
    );
  };

  if (loading) {
    return <div className="p-2 text-sm text-gray-500">Loading reports...</div>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={exportOrders}
          className="rounded-2xl bg-[#1d6f42] px-5 py-3 text-sm font-semibold text-white"
        >
          📄 Export Orders Excel
        </button>

        <button
          type="button"
          onClick={exportProducts}
          className="rounded-2xl bg-[#1d6f42] px-5 py-3 text-sm font-semibold text-white"
        >
          📄 Export Products Excel
        </button>

        <button
          type="button"
          onClick={exportCustomers}
          className="rounded-2xl bg-[#1d6f42] px-5 py-3 text-sm font-semibold text-white"
        >
          📄 Export Customers Excel
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ReportCard title="Top Products (by qty sold)" icon="🏆">
          <ProgressList
            items={report.topProducts}
            labelKey="name"
            valueKey="quantity"
            formatValue={(value) => `${value} units`}
          />
        </ReportCard>

        <ReportCard title="Revenue by Category" icon="📉">
          <ProgressList
            items={report.revenueByCategory}
            labelKey="category"
            valueKey="revenue"
            formatValue={(value) => `₹${Number(value).toLocaleString("en-IN")}`}
          />
        </ReportCard>

        <ReportCard title="Monthly Revenue" icon="📅">
          <ProgressList
            items={report.monthlySales}
            labelKey="month"
            valueKey="revenue"
            formatValue={(value) => `₹${Number(value).toLocaleString("en-IN")}`}
          />
        </ReportCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ReportCard title="Top Customers by Spend" icon="🏅">
          <ProgressList
            items={report.topCustomers.map((customer) => ({
              label: `${customer.name} (${String(customer.phone || "").slice(
                -4
              )})`,
              spend: customer.spend,
            }))}
            labelKey="label"
            valueKey="spend"
            formatValue={(value) => `₹${Number(value).toLocaleString("en-IN")}`}
          />
        </ReportCard>

        <div className="rounded-[20px] border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h3 className="text-[15px] font-bold text-gray-900">Summary</h3>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl bg-[#fafafa] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[1px] text-gray-400">
                Revenue
              </p>
              <p className="mt-2 text-2xl font-extrabold text-[#128c7e]">
                ₹{Number(report.totalRevenue || 0).toLocaleString("en-IN")}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fafafa] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[1px] text-gray-400">
                Orders
              </p>
              <p className="mt-2 text-2xl font-extrabold text-gray-900">
                {report.totalOrders}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fafafa] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[1px] text-gray-400">
                Customers
              </p>
              <p className="mt-2 text-2xl font-extrabold text-gray-900">
                {report.totalCustomers}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fafafa] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[1px] text-gray-400">
                Products
              </p>
              <p className="mt-2 text-2xl font-extrabold text-gray-900">
                {report.totalProducts}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Active: {report.activeProducts}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fafafa] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[1px] text-gray-400">
                Avg Order
              </p>
              <p className="mt-2 text-2xl font-extrabold text-gray-900">
                ₹{Number(report.averageOrderValue || 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}