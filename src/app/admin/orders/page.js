"use client";

import { useEffect, useMemo, useState } from "react";
import useAuth from "@/hooks/useAuth";
import {
  getOrdersByStoreId,
  getStoreByOwnerId,
  updateOrderStatus,
} from "@/lib/firestore";

const ORDER_STATUS_OPTIONS = [
  "new",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const PAYMENT_STATUS_OPTIONS = ["pending", "created", "paid", "failed"];

function StatCard({ label, value, accent = "text-gray-900", subtext = "" }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-extrabold ${accent}`}>{value}</p>
      {subtext ? <p className="mt-1 text-xs text-gray-500">{subtext}</p> : null}
    </div>
  );
}

function getOrderStatusBadge(status) {
  const normalized = String(status || "new").toLowerCase();

  const styles = {
    new: "bg-[#e8f5e9] text-[#2e7d32]",
    processing: "bg-[#fff8e1] text-[#f57f17]",
    shipped: "bg-[#e3f2fd] text-[#1565c0]",
    delivered: "bg-[#e8f5ee] text-[#128c7e]",
    cancelled: "bg-[#fdecef] text-[#c62828]",
  };

  return styles[normalized] || "bg-gray-100 text-gray-700";
}

function getPaymentStatusBadge(status) {
  const normalized = String(status || "pending").toLowerCase();

  const styles = {
    pending: "bg-[#fff8e1] text-[#f57f17]",
    created: "bg-[#e3f2fd] text-[#1565c0]",
    paid: "bg-[#e8f5e9] text-[#2e7d32]",
    failed: "bg-[#fdecef] text-[#c62828]",
  };

  return styles[normalized] || "bg-gray-100 text-gray-700";
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

function formatDate(createdAt) {
  if (!createdAt) return "-";

  if (typeof createdAt?.seconds === "number") {
    return new Date(createdAt.seconds * 1000).toLocaleString("en-IN");
  }

  if (typeof createdAt?.toDate === "function") {
    return createdAt.toDate().toLocaleString("en-IN");
  }

  if (typeof createdAt === "string") {
    const date = new Date(createdAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("en-IN");
    }
  }

  if (createdAt instanceof Date) {
    return createdAt.toLocaleString("en-IN");
  }

  return "-";
}

function getItemsCount(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
}

export default function AdminOrdersPage() {
  const { user, loading: authLoading } = useAuth();

  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (authLoading) return;

      if (!user?.uid) {
        if (isMounted) {
          setStore(null);
          setOrders([]);
          setLoading(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setLoading(true);
          setError("");
          setSuccess("");
        }

        const storeData = await getStoreByOwnerId(user.uid);

        if (!isMounted) return;

        if (!storeData) {
          setError("No store found for this account.");
          setStore(null);
          setOrders([]);
          return;
        }

        setStore(storeData);

        const storeOrders = await getOrdersByStoreId(storeData.id);

        if (!isMounted) return;

        setOrders(Array.isArray(storeOrders) ? storeOrders : []);
      } catch (err) {
        console.error("Orders page load error:", err);

        if (isMounted) {
          setError("Failed to load orders.");
          setStore(null);
          setOrders([]);
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

  const refreshOrders = async (storeId) => {
    if (!storeId) return;

    const storeOrders = await getOrdersByStoreId(storeId);
    setOrders(Array.isArray(storeOrders) ? storeOrders : []);
  };
  const triggerStatusWebhook = async (orderId) => {
    const response = await fetch("/api/order-status-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.webhookError ||
          data?.error ||
          "Order status webhook trigger failed",
      );
    }

    return data;
  };

  const handleStatusUpdate = async (orderId, field, value) => {
    if (!store?.id || !orderId || !field) return;

    try {
      setUpdatingId(orderId);
      setError("");
      setSuccess("");

      await updateOrderStatus(orderId, {
        [field]: value,
      });

      const webhookResult = await triggerStatusWebhook(orderId);

      await refreshOrders(store.id);

      setSuccess(
        webhookResult?.webhookTriggered
          ? "Order updated successfully and webhook triggered."
          : "Order updated successfully, but webhook was not triggered.",
      );
    } catch (err) {
      console.error("Order update error:", err);

      setError(
        err?.message ||
          "Order updated, but webhook trigger failed. Please check webhook settings.",
      );

      await refreshOrders(store.id);
    } finally {
      setUpdatingId("");
    }
  };

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    const result = orders.filter((order) => {
      const customerName =
        order?.customer?.name || order?.customerName || "Unknown Customer";
      const customerPhone = order?.customer?.phone || order?.phone || "";
      const customerAddress = order?.customer?.address || order?.address || "";
      const orderStatus = order?.orderStatus || order?.status || "new";

      const matchesSearch =
        !term ||
        String(customerName).toLowerCase().includes(term) ||
        String(customerPhone).toLowerCase().includes(term) ||
        String(customerAddress).toLowerCase().includes(term) ||
        String(order?.paymentStatus || "")
          .toLowerCase()
          .includes(term) ||
        String(orderStatus || "")
          .toLowerCase()
          .includes(term) ||
        String(order?.paymentMethod || "")
          .toLowerCase()
          .includes(term) ||
        String(order?.id || "")
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        String(orderStatus || "").toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      const aTime = getOrderTimestamp(a);
      const bTime = getOrderTimestamp(b);

      const aAmount = Number(a?.totalAmount || 0);
      const bAmount = Number(b?.totalAmount || 0);

      if (sortBy === "oldest") return aTime - bTime;
      if (sortBy === "highest") return bAmount - aAmount;

      return bTime - aTime;
    });

    return result;
  }, [orders, search, statusFilter, sortBy]);

  const summary = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        const orderStatus = String(
          order?.orderStatus || order?.status || "",
        ).toLowerCase();
        const paymentStatus = String(order?.paymentStatus || "").toLowerCase();

        acc.totalOrders += 1;
        acc.totalAmount += Number(order?.totalAmount || 0);

        if (orderStatus === "new") acc.newOrders += 1;
        if (paymentStatus === "paid") acc.paidOrders += 1;

        return acc;
      },
      {
        totalOrders: 0,
        totalAmount: 0,
        newOrders: 0,
        paidOrders: 0,
      },
    );
  }, [filteredOrders]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading orders...</div>;
  }

  if (!user && !authLoading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Please log in to view orders.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Orders
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Order list for {store?.storeName || "your store"}.
            </p>
          </div>

          <div className="rounded-full bg-[#e8f5ee] px-3 py-1 text-xs font-semibold text-[#128c7e]">
            {filteredOrders.length} visible orders
          </div>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Orders"
            value={summary.totalOrders}
            accent="text-gray-900"
            subtext="Filtered order count"
          />
          <StatCard
            label="Revenue"
            value={`₹${Number(summary.totalAmount || 0).toLocaleString("en-IN")}`}
            accent="text-[#128c7e]"
            subtext="Total value of visible orders"
          />
          <StatCard
            label="New Orders"
            value={summary.newOrders}
            accent="text-[#ff6b35]"
            subtext="Needs your attention"
          />
          <StatCard
            label="Paid Orders"
            value={summary.paidOrders}
            accent="text-[#1976d2]"
            subtext="Payment received"
          />
        </div>

        <div className="mb-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Order Directory
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Search, filter and update all store orders.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                type="text"
                placeholder="Search by customer, phone, address, order id"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#128c7e] md:w-80"
              />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#128c7e]"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Value</option>
              </select>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                statusFilter === "all"
                  ? "bg-[#e8f5ee] text-[#128c7e]"
                  : "border border-gray-300 bg-white text-gray-600"
              }`}
            >
              All
            </button>

            {ORDER_STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
                  statusFilter === status
                    ? "bg-[#e8f5ee] text-[#128c7e]"
                    : "border border-gray-300 bg-white text-gray-600"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          ) : null}

          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              No orders found yet.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const customerName =
                  order?.customer?.name ||
                  order?.customerName ||
                  "Unknown Customer";
                const customerPhone =
                  order?.customer?.phone || order?.phone || "-";
                const customerAddress =
                  order?.customer?.address || order?.address || "-";
                const orderStatus =
                  order?.orderStatus || order?.status || "new";
                const paymentStatus = order?.paymentStatus || "pending";

                return (
                  <div
                    key={order.id}
                    className="overflow-hidden rounded-3xl border border-gray-200 bg-white"
                  >
                    <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-gray-900">
                            {order?.orderId
                              ? order.orderId
                              : `Order #${String(order?.id || "").slice(0, 10)}`}
                          </p>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getOrderStatusBadge(
                              orderStatus,
                            )}`}
                          >
                            {String(orderStatus).charAt(0).toUpperCase() +
                              String(orderStatus).slice(1)}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getPaymentStatusBadge(
                              paymentStatus,
                            )}`}
                          >
                            {String(paymentStatus).charAt(0).toUpperCase() +
                              String(paymentStatus).slice(1)}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(order?.createdAt)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-500">Order Total</p>
                        <p className="text-lg font-extrabold text-[#128c7e]">
                          ₹
                          {Number(order?.totalAmount || 0).toLocaleString(
                            "en-IN",
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-5 px-5 py-5 xl:grid-cols-[1.25fr_0.95fr]">
                      <div>
                        <div className="rounded-2xl bg-gray-50 p-4">
                          <h3 className="text-sm font-bold text-gray-900">
                            Customer Details
                          </h3>

                          <div className="mt-3 space-y-2 text-sm text-gray-700">
                            <p>
                              <span className="font-semibold text-gray-900">
                                Name:
                              </span>{" "}
                              {customerName}
                            </p>
                            <p>
                              <span className="font-semibold text-gray-900">
                                Phone:
                              </span>{" "}
                              {customerPhone}
                            </p>
                            <p>
                              <span className="font-semibold text-gray-900">
                                Address:
                              </span>{" "}
                              {customerAddress}
                            </p>
                            <p>
                              <span className="font-semibold text-gray-900">
                                Payment Method:
                              </span>{" "}
                              {order?.paymentMethod || "COD"}
                            </p>
                            <p>
                              <span className="font-semibold text-gray-900">
                                Items Count:
                              </span>{" "}
                              {getItemsCount(order?.items)}
                            </p>
                          </div>
                        </div>

                        {(order?.razorpayOrderId ||
                          order?.razorpayPaymentId) && (
                          <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                            <h3 className="text-sm font-bold text-gray-900">
                              Payment Reference
                            </h3>

                            <div className="mt-3 space-y-2 text-sm text-gray-700">
                              {order?.razorpayOrderId ? (
                                <p className="break-all">
                                  <span className="font-semibold text-gray-900">
                                    Razorpay Order ID:
                                  </span>{" "}
                                  {order.razorpayOrderId}
                                </p>
                              ) : null}

                              {order?.razorpayPaymentId ? (
                                <p className="break-all">
                                  <span className="font-semibold text-gray-900">
                                    Razorpay Payment ID:
                                  </span>{" "}
                                  {order.razorpayPaymentId}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        )}

                        {Array.isArray(order?.items) &&
                        order.items.length > 0 ? (
                          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
                            <div className="bg-gray-50 px-4 py-3">
                              <h4 className="text-sm font-bold text-gray-900">
                                Order Items
                              </h4>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[720px]">
                                <thead>
                                  <tr className="border-b border-gray-100 bg-white text-left text-xs uppercase tracking-wide text-gray-400">
                                    <th className="px-4 py-3 font-semibold">
                                      Product
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                      Category
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                      Qty
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                      Price
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                      Subtotal
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {order.items.map((item, index) => (
                                    <tr
                                      key={`${order.id}-${item?.id || index}`}
                                      className="border-b border-gray-100 last:border-b-0"
                                    >
                                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                        {item?.name || "-"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700">
                                        {item?.category || "-"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700">
                                        {item?.quantity || 0}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700">
                                        ₹
                                        {Number(
                                          item?.price || 0,
                                        ).toLocaleString("en-IN")}
                                      </td>
                                      <td className="px-4 py-3 text-sm font-bold text-gray-900">
                                        ₹
                                        {(
                                          Number(item?.price || 0) *
                                          Number(item?.quantity || 0)
                                        ).toLocaleString("en-IN")}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <div className="rounded-2xl bg-gray-50 p-4">
                          <h3 className="text-sm font-bold text-gray-900">
                            Update Order
                          </h3>

                          <div className="mt-4 space-y-4">
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Order Status
                              </label>
                              <select
                                value={orderStatus}
                                onChange={(e) =>
                                  handleStatusUpdate(
                                    order.id,
                                    "orderStatus",
                                    e.target.value,
                                  )
                                }
                                disabled={updatingId === order.id}
                                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#128c7e] disabled:opacity-60"
                              >
                                {ORDER_STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>
                                    {status.charAt(0).toUpperCase() +
                                      status.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Payment Status
                              </label>
                              <select
                                value={paymentStatus}
                                onChange={(e) =>
                                  handleStatusUpdate(
                                    order.id,
                                    "paymentStatus",
                                    e.target.value,
                                  )
                                }
                                disabled={updatingId === order.id}
                                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#128c7e] disabled:opacity-60"
                              >
                                {PAYMENT_STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>
                                    {status.charAt(0).toUpperCase() +
                                      status.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-2xl bg-white p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                  Amount
                                </p>
                                <p className="mt-2 text-lg font-bold text-gray-900">
                                  ₹
                                  {Number(
                                    order?.totalAmount || 0,
                                  ).toLocaleString("en-IN")}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-white p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                  Payment Method
                                </p>
                                <p className="mt-2 text-lg font-bold text-gray-900">
                                  {order?.paymentMethod || "COD"}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-3 text-xs text-gray-500">
                              {updatingId === order.id
                                ? "Updating order..."
                                : "Use the dropdowns above to keep order and payment states in sync."}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
