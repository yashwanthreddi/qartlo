"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import useAuth from "@/hooks/useAuth";
import { getStoreByOwnerId } from "@/lib/firestore";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [checkingStore, setCheckingStore] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    async function checkExistingUserStore() {
      if (loading || !user) return;

      try {
        setCheckingStore(true);
        const store = await getStoreByOwnerId(user.uid);

        if (store) {
          router.replace("/admin");
        } else {
          router.replace("/create-store");
        }
      } catch (err) {
        console.error("Store check error:", err);
        setError("Unable to verify store. Please try again.");
      } finally {
        setCheckingStore(false);
      }
    }

    checkExistingUserStore();
  }, [user, loading, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const email = form.email.trim();
    const password = form.password;

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setSubmitting(true);

      const result = await signInWithEmailAndPassword(auth, email, password);
      const store = await getStoreByOwnerId(result.user.uid);

      if (store) {
        router.replace("/admin");
      } else {
        router.replace("/create-store");
      }
    } catch (err) {
      console.error("Login error:", err);

      switch (err?.code) {
        case "auth/invalid-email":
          setError("Invalid email address.");
          break;
        case "auth/user-not-found":
        case "auth/invalid-credential":
          setError("Invalid email or password.");
          break;
        case "auth/wrong-password":
          setError("Incorrect password.");
          break;
        case "auth/too-many-requests":
          setError("Too many attempts. Please try again later.");
          break;
        default:
          setError("Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checkingStore) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f6f7fb_0%,#eef7f5_45%,#f9fbff_100%)] px-4">
        <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-white/90 p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-[#128c7e]/10" />
          <p className="text-sm font-medium text-gray-600">Checking session...</p>
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
              Store Admin Panel
            </div>

            <h1 className="mt-6 text-5xl font-bold leading-[1.1] text-gray-900">
              Manage your store with a cleaner, faster admin login experience.
            </h1>

            <p className="mt-5 text-lg leading-8 text-gray-600">
              Access products, orders, customers, reports, and store settings from one place with secure Firebase authentication.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
                <p className="text-2xl">📦</p>
                <p className="mt-3 text-sm font-semibold text-gray-900">Products</p>
                <p className="mt-1 text-sm text-gray-500">Manage stock and pricing</p>
              </div>

              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
                <p className="text-2xl">🧾</p>
                <p className="mt-3 text-sm font-semibold text-gray-900">Orders</p>
                <p className="mt-1 text-sm text-gray-500">Track payments and status</p>
              </div>

              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm">
                <p className="text-2xl">📊</p>
                <p className="mt-3 text-sm font-semibold text-gray-900">Reports</p>
                <p className="mt-1 text-sm text-gray-500">View performance insights</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_20px_70px_rgba(15,23,42,0.10)] backdrop-blur sm:p-10">
            <div className="mb-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#128c7e]/10 text-3xl">
                🔐
              </div>

              <h1 className="mt-5 text-3xl font-bold text-gray-900">
                Welcome back
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Sign in to access your store dashboard and manage your business.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-gray-200 bg-[#fafafa] px-4 py-3.5 text-sm text-gray-900 outline-none transition focus:border-[#128c7e] focus:bg-white focus:ring-4 focus:ring-[#128c7e]/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Password
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-gray-200 bg-[#fafafa] px-4 py-3.5 pr-20 text-sm text-gray-900 outline-none transition focus:border-[#128c7e] focus:bg-white focus:ring-4 focus:ring-[#128c7e]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

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
                {submitting ? "Signing in..." : "Login to Admin"}
              </button>
            </form>

            <div className="mt-6 border-t border-gray-100 pt-5 text-center">
              <p className="text-sm text-gray-500">
                Don’t have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/signup")}
                  className="font-semibold text-[#128c7e] hover:underline"
                >
                  Create one
                </button>
              </p>

              
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}