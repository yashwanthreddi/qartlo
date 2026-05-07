"use client";

import { useEffect, useMemo, useState } from "react";
import useAuth from "@/hooks/useAuth";
import { getOrdersByStoreId, getStoreByOwnerId } from "@/lib/firestore";

function getOrderTimestamp(order) {
  const createdAt = order?.createdAt;

  if (!createdAt) return 0;

  if (typeof createdAt?.seconds === "number") {
    return createdAt.seconds;
  }

  if (typeof createdAt?.toDate === "function") {
    return Math.floor(createdAt.toDate().getTime() / 1000);
  }

  if (typeof createdAt === "string" || createdAt instanceof Date) {
    const time = new Date(createdAt).getTime();
    return Number.isNaN(time) ? 0 : Math.floor(time / 1000);
  }

  return 0;
}

function formatDate(seconds) {
  if (!seconds) return "-";

  const date = new Date(seconds * 1000);
  return date.toLocaleDateString("en-GB");
}

function formatDateTime(seconds) {
  if (!seconds) return "-";

  const date = new Date(seconds * 1000);
  return `${date.toLocaleDateString("en-GB")} ${date.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  )}`;
}

function getInitial(name) {
  return String(name || "C").trim().charAt(0).toUpperCase();
}

function getOrderItemSummary(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "No items";
  }

  return items
    .map((item) => {
      const name = item?.name || "Item";
      const qty = Number(item?.quantity || 0);
      return `${name} × ${qty}`;
    })
    .join(", ");
}

function getOrderStatusLabel(order) {
  const status = String(order?.status || "").toLowerCase();
  const paymentStatus = String(order?.paymentStatus || "").toLowerCase();

  if (paymentStatus === "paid") return "Paid";
  if (status === "completed") return "Completed";
  if (status === "confirmed") return "Confirmed";
  if (status === "accepted") return "Accepted";
  if (status === "cancelled") return "Cancelled";
  if (status === "new") return "New";
  if (status === "payment_pending") return "Payment Pending";
  if (status === "payment_abandoned") return "Payment Abandoned";
  if (status === "payment_verification_failed") return "Verification Failed";

  return order?.status || order?.paymentStatus || "Pending";
}

function getOrderStatusClass(order) {
  const status = String(order?.status || "").toLowerCase();
  const paymentStatus = String(order?.paymentStatus || "").toLowerCase();

  if (paymentStatus === "paid" || status === "completed" || status === "accepted") {
    return "bg-green-100 text-green-700";
  }

  if (status === "new" || status === "confirmed") {
    return "bg-blue-100 text-blue-700";
  }

  if (
    status === "payment_pending" ||
    paymentStatus === "pending" ||
    paymentStatus === "cod_pending"
  ) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (
    status === "payment_abandoned" ||
    status === "payment_verification_failed" ||
    paymentStatus === "verification_failed" ||
    status === "cancelled"
  ) {
    return "bg-red-100 text-red-700";
  }

  return "bg-gray-100 text-gray-700";
}

export default function AdminCustomersPage() {
  const { user, loading: authLoading } = useAuth();

  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("spend");
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

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
          setStore(null);
          setOrders([]);
          setError("No store found for this account.");
          setLoading(false);
          return;
        }

        setStore(storeData);

        const storeOrders = await getOrdersByStoreId(storeData.id);

        if (!isMounted) return;

        setOrders(Array.isArray(storeOrders) ? storeOrders : []);
      } catch (err) {
        console.error("Customers page load error:", err);

        if (isMounted) {
          setStore(null);
          setOrders([]);
          setError("Failed to load customers.");
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

  const customers = useMemo(() => {
    const map = new Map();

    for (const order of orders) {
      const customerName =
        order?.customer?.name ||
        order?.customerName ||
        order?.name ||
        "Unknown";

      const phone =
        order?.customer?.phone ||
        order?.phone ||
        order?.customerPhone ||
        "";

      const address =
        order?.customer?.address ||
        order?.address ||
        order?.customer?.city ||
        order?.customerAddress ||
        "-";

      const normalizedPhone = String(phone || "").replace(/\D/g, "").slice(-10);
      const phoneKey = normalizedPhone.trim();
      const fallbackKey = String(customerName || "").trim().toLowerCase();
      const key = phoneKey || fallbackKey;

      if (!key) continue;

      const orderAmount = Number(
        order?.totalAmount ?? order?.amount ?? order?.total ?? 0
      );

      const orderItems = Array.isArray(order?.items)
        ? order.items.reduce(
            (sum, item) => sum + Number(item?.quantity || 0),
            0
          )
        : 0;

      const createdSeconds = getOrderTimestamp(order);

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          customerName,
          phone: phone || "-",
          address,
          totalOrders: 1,
          totalSpent: orderAmount,
          totalItems: orderItems,
          lastOrderAt: createdSeconds,
          orders: [order],
        });
      } else {
        const existing = map.get(key);

        existing.totalOrders += 1;
        existing.totalSpent += orderAmount;
        existing.totalItems += orderItems;
        existing.orders.push(order);

        if (createdSeconds >= existing.lastOrderAt) {
          existing.lastOrderAt = createdSeconds;
          existing.customerName = customerName || existing.customerName;
          existing.phone = phone || existing.phone;
          existing.address = address || existing.address;
        }
      }
    }

    return Array.from(map.values()).map((customer) => ({
      ...customer,
      orders: [...customer.orders].sort(
        (a, b) => getOrderTimestamp(b) - getOrderTimestamp(a)
      ),
    }));
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    const result = customers.filter((customer) => {
      return (
        !term ||
        String(customer?.customerName || "").toLowerCase().includes(term) ||
        String(customer?.phone || "").toLowerCase().includes(term) ||
        String(customer?.address || "").toLowerCase().includes(term)
      );
    });

    result.sort((a, b) => {
      if (sortBy === "orders") {
        return Number(b.totalOrders || 0) - Number(a.totalOrders || 0);
      }

      if (sortBy === "recent") {
        return Number(b.lastOrderAt || 0) - Number(a.lastOrderAt || 0);
      }

      return Number(b.totalSpent || 0) - Number(a.totalSpent || 0);
    });

    return result;
  }, [customers, search, sortBy]);

  const summary = useMemo(() => {
    const totalCustomers = filteredCustomers.length;

    const repeatBuyers = filteredCustomers.filter(
      (customer) => Number(customer.totalOrders || 0) > 1
    ).length;

    const totalRevenue = filteredCustomers.reduce(
      (sum, customer) => sum + Number(customer.totalSpent || 0),
      0
    );

    const avgOrderValue =
      orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

    return {
      totalCustomers,
      repeatBuyers,
      avgOrderValue,
    };
  }, [filteredCustomers, orders.length]);

  const exportCustomers = () => {
    if (filteredCustomers.length === 0) {
      alert("No customers to export");
      return;
    }

    const headers = [
      "Customer Name",
      "Phone",
      "Address",
      "Total Orders",
      "Total Items",
      "Total Spent",
      "Avg Order Value",
      "Last Order Date",
    ];

    const rows = filteredCustomers.map((customer) => [
      customer.customerName || "",
      customer.phone || "",
      customer.address || "",
      Number(customer.totalOrders || 0),
      Number(customer.totalItems || 0),
      Number(customer.totalSpent || 0),
      Math.round(
        Number(customer.totalSpent || 0) / Number(customer.totalOrders || 1)
      ),
      formatDate(customer.lastOrderAt),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.setAttribute(
      "download",
      `${store?.slug || "store"}-customers.csv`
    );

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleCustomer = (customerId) => {
    setExpandedCustomerId((prev) => (prev === customerId ? null : customerId));
  };

  if (loading) {
    return <div className="p-2 text-sm text-gray-500">Loading customers...</div>;
  }

  if (!user && !authLoading) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Please log in to view customers.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] bg-gradient-to-r from-[#128c7e] to-[#0f6f65] p-5 text-white shadow-sm">
        <h1 className="text-[18px] font-bold md:text-[20px]">
          Customer Analytics
        </h1>
        <p className="mt-1 text-sm text-white/85">
          Phone number is the primary key — every order links to a customer
          profile automatically.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[16px] bg-white/12 px-4 py-4 text-center">
            <p className="text-3xl font-extrabold">{summary.totalCustomers}</p>
            <p className="mt-1 text-sm text-white/80">Total Customers</p>
          </div>

          <div className="rounded-[16px] bg-white/12 px-4 py-4 text-center">
            <p className="text-3xl font-extrabold">{summary.repeatBuyers}</p>
            <p className="mt-1 text-sm text-white/80">Repeat Buyers</p>
          </div>

          <div className="rounded-[16px] bg-white/12 px-4 py-4 text-center">
            <p className="text-3xl font-extrabold">
              ₹{Number(summary.avgOrderValue || 0).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-sm text-white/80">Avg Order Value</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <input
          type="text"
          placeholder="Search by name, phone or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#128c7e]"
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#128c7e] lg:w-[180px]"
        >
          <option value="spend">By Total Spend</option>
          <option value="orders">By Order Count</option>
          <option value="recent">Most Recent</option>
        </select>

        <button
          type="button"
          onClick={exportCustomers}
          className="rounded-2xl bg-[#1d6f42] px-5 py-3 text-sm font-semibold text-white"
        >
          📄 Export
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!error && filteredCustomers.length === 0 ? (
        <div className="rounded-[22px] border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
          No customers found yet.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCustomers.map((customer) => {
            const avgOrder = Math.round(
              Number(customer.totalSpent || 0) /
                Number(customer.totalOrders || 1)
            );

            const isExpanded = expandedCustomerId === customer.id;

            return (
              <div
                key={customer.id}
                className="overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleCustomer(customer.id)}
                  className="w-full p-4 text-left transition hover:bg-gray-50"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#e8f5ee] text-[22px] font-bold text-[#128c7e]">
                        {getInitial(customer.customerName)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-gray-900">
                          {customer.customerName}
                        </p>
                        <p className="mt-0.5 text-[15px] font-semibold text-[#128c7e]">
                          {customer.phone}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {customer.address}
                        </p>
                      </div>

                      <div className="text-sm font-semibold text-[#128c7e]">
                        {isExpanded ? "Hide Orders ▲" : "View Orders ▼"}
                      </div>
                    </div>

                    <div className="grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-3">
                      <div className="text-center">
                        <p className="text-[28px] font-extrabold text-gray-900">
                          {customer.totalOrders}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">Orders</p>
                      </div>

                      <div className="text-center">
                        <p className="text-[28px] font-extrabold text-gray-900">
                          ₹
                          {Number(customer.totalSpent || 0).toLocaleString(
                            "en-IN"
                          )}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">Total Spend</p>
                      </div>

                      <div className="text-center">
                        <p className="text-[28px] font-extrabold text-gray-900">
                          ₹{Number(avgOrder || 0).toLocaleString("en-IN")}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">Avg Order</p>
                      </div>
                    </div>

                    <div className="text-sm text-gray-400">
                      Last order: {formatDate(customer.lastOrderAt)} · Tap to see
                      order history
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-[#fafafa] px-4 py-4">
                    <h3 className="mb-3 text-sm font-bold text-gray-900">
                      Order History
                    </h3>

                    <div className="space-y-3">
                      {customer.orders.map((order, index) => {
                        const createdAt = getOrderTimestamp(order);
                        const totalAmount = Number(
                          order?.totalAmount ?? order?.amount ?? order?.total ?? 0
                        );
                        const totalItems = Array.isArray(order?.items)
                          ? order.items.reduce(
                              (sum, item) => sum + Number(item?.quantity || 0),
                              0
                            )
                          : 0;

                        return (
                          <div
                            key={order.id || `${customer.id}-${index}`}
                            className="rounded-2xl border border-gray-200 bg-white p-4"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-sm font-bold text-gray-900">
                                  Order ID: {order.id || "—"}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                  {formatDateTime(createdAt)}
                                </p>
                              </div>

                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusClass(
                                  order
                                )}`}
                              >
                                {getOrderStatusLabel(order)}
                              </span>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                              <div className="rounded-xl bg-gray-50 px-3 py-3">
                                <p className="text-xs text-gray-400">
                                  Total Amount
                                </p>
                                <p className="mt-1 text-sm font-bold text-gray-900">
                                  ₹{totalAmount.toLocaleString("en-IN")}
                                </p>
                              </div>

                              <div className="rounded-xl bg-gray-50 px-3 py-3">
                                <p className="text-xs text-gray-400">
                                  Total Items
                                </p>
                                <p className="mt-1 text-sm font-bold text-gray-900">
                                  {totalItems}
                                </p>
                              </div>

                              <div className="rounded-xl bg-gray-50 px-3 py-3">
                                <p className="text-xs text-gray-400">
                                  Payment Method
                                </p>
                                <p className="mt-1 text-sm font-bold capitalize text-gray-900">
                                  {order?.paymentMethod || "—"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Items
                              </p>
                              <p className="mt-2 text-sm leading-6 text-gray-700">
                                {getOrderItemSummary(order?.items)}
                              </p>
                            </div>

                            {order?.notes ? (
                              <div className="mt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                  Notes
                                </p>
                                <p className="mt-2 text-sm leading-6 text-gray-700">
                                  {order.notes}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}