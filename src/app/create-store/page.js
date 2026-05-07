"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { createStore, getStoreByOwnerId } from "@/lib/firestore";

function makeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CreateStorePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState({
    storeName: "",
    phone: "",
    address: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  const slugPreview = useMemo(() => makeSlug(form.storeName), [form.storeName]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (loading) return;

      if (!user?.uid) {
        if (isMounted) {
          setChecking(false);
        }
        router.replace("/login");
        return;
      }

      try {
        const existingStore = await getStoreByOwnerId(user.uid);

        if (!isMounted) return;

        if (existingStore) {
          router.replace("/admin");
          return;
        }
      } catch (err) {
        console.error("Store check error:", err);

        if (isMounted) {
          setError("Unable to check store status.");
        }
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [user, loading, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    setError("");

    const storeName = String(form.storeName || "").trim();
    const phone = String(form.phone || "").trim();
    const address = String(form.address || "").trim();
    const slug = makeSlug(storeName);

    if (!storeName) {
      setError("Store name is required.");
      return;
    }

    if (!slug) {
      setError("Please enter a valid store name.");
      return;
    }

    if (!user?.uid) {
      setError("User session not found. Please log in again.");
      return;
    }

    try {
      setSubmitting(true);

      const existingStore = await getStoreByOwnerId(user.uid);

      if (existingStore) {
        router.replace("/admin");
        return;
      }

      await createStore({
        ownerId: user.uid,
        storeName,
        slug,
        phone,
        address,
      });

      router.replace("/admin");
    } catch (err) {
      console.error("Create store error:", err);
      setError("Failed to create store. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f6f7fb_0%,#eef7f5_45%,#f9fbff_100%)] px-4">
        <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-white/90 p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-[#128c7e]/10" />
          <p className="text-sm font-medium text-gray-600">
            Preparing your store setup...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f6f7fb_0%,#eef7f5_45%,#f9fbff_100%)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-8 lg:grid-cols-2">
        <div className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center rounded-full border border-[#128c7e]/15 bg-[#128c7e]/10 px-4 py-2 text-sm font-semibold text-[#128c7e]">
              Create Your Store
            </div>

            <h1 className="mt-6 text-5xl font-bold leading-[1.1] text-gray-900">
              Set up your store and start selling with Qartlo.
            </h1>

            <p className="mt-5 text-lg leading-8 text-gray-600">
              Add your store details, generate your unique store link, and get ready
              to manage products, orders, and customers from one place.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
                <p className="text-2xl">🏪</p>
                <p className="mt-3 text-sm font-semibold text-gray-900">
                  Store Setup
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Create your brand presence
                </p>
              </div>

              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
                <p className="text-2xl">🔗</p>
                <p className="mt-3 text-sm font-semibold text-gray-900">
                  Store Link
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Generate your unique slug
                </p>
              </div>

              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
                <p className="text-2xl">🚀</p>
                <p className="mt-3 text-sm font-semibold text-gray-900">
                  Go Live
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Start managing your business
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_20px_70px_rgba(15,23,42,0.10)] backdrop-blur sm:p-10">
            <div className="mb-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#128c7e]/10 text-3xl">
                🏪
              </div>
              <h1 className="mt-5 text-3xl font-bold text-gray-900">
                Create Your Store
              </h1>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Set up your store before adding products and receiving orders.
              </p>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Store Name
                </label>
                <input
                  type="text"
                  name="storeName"
                  value={form.storeName}
                  onChange={handleChange}
                  placeholder="Enter your store name"
                  className="w-full rounded-2xl border border-gray-200 bg-[#fafafa] px-4 py-3.5 text-sm text-gray-900 outline-none transition focus:border-[#128c7e] focus:bg-white focus:ring-4 focus:ring-[#128c7e]/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Phone
                </label>
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter your phone number"
                  className="w-full rounded-2xl border border-gray-200 bg-[#fafafa] px-4 py-3.5 text-sm text-gray-900 outline-none transition focus:border-[#128c7e] focus:bg-white focus:ring-4 focus:ring-[#128c7e]/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Address
                </label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Enter store address"
                  rows={4}
                  className="w-full rounded-2xl border border-gray-200 bg-[#fafafa] px-4 py-3.5 text-sm text-gray-900 outline-none transition focus:border-[#128c7e] focus:bg-white focus:ring-4 focus:ring-[#128c7e]/10"
                />
              </div>

              {form.storeName ? (
                <div className="rounded-2xl border border-[#128c7e]/15 bg-[#128c7e]/5 px-4 py-3 text-sm text-gray-700">
                  Store link:{" "}
                  <span className="font-semibold text-[#128c7e]">
                    /{slugPreview}
                  </span>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-[#128c7e] py-3.5 text-sm font-bold text-white transition hover:bg-[#0f7468] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating Store..." : "Create Store"}
              </button>
            </form>

            <div className="mt-6 border-t border-gray-100 pt-5 text-center">
              <p className="text-xs leading-5 text-gray-400">
                Your store details will be saved securely in the database
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}