"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) setError("");
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (!name) {
      setError("Please enter your full name.");
      return;
    }

    if (!email || !password || !confirmPassword) {
      setError("Please fill all required fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    try {
      setSubmitting(true);

      const result = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = result.user;

      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        name,
        email,
        role: "owner",
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.replace("/create-store");
    } catch (err) {
      console.error("Signup error:", err);

      switch (err?.code) {
        case "auth/email-already-in-use":
          setError("This email is already registered. Please log in.");
          break;
        case "auth/invalid-email":
          setError("Invalid email address.");
          break;
        case "auth/weak-password":
          setError("Password is too weak.");
          break;
        default:
          setError("Account creation failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f6f7fb_0%,#eef7f5_45%,#f9fbff_100%)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-8 lg:grid-cols-2">
        <div className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center rounded-full border border-[#128c7e]/15 bg-[#128c7e]/10 px-4 py-2 text-sm font-semibold text-[#128c7e]">
              Store Admin Panel
            </div>

            <h1 className="mt-6 text-5xl font-bold leading-[1.1] text-gray-900">
              Create your account and start building your online store.
            </h1>

            <p className="mt-5 text-lg leading-8 text-gray-600">
              Sign up to create your store, manage products, track orders, and grow your business with Qartlo.
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
                👤
              </div>

              <h1 className="mt-5 text-3xl font-bold text-gray-900">
                Create account
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Create your account to set up your store and start selling online.
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  className="w-full rounded-2xl border border-gray-200 bg-[#fafafa] px-4 py-3.5 text-sm text-gray-900 outline-none transition focus:border-[#128c7e] focus:bg-white focus:ring-4 focus:ring-[#128c7e]/10"
                />
              </div>

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
                    autoComplete="new-password"
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

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-gray-200 bg-[#fafafa] px-4 py-3.5 text-sm text-gray-900 outline-none transition focus:border-[#128c7e] focus:bg-white focus:ring-4 focus:ring-[#128c7e]/10"
                />
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
                {submitting ? "Creating account..." : "Create New Account"}
              </button>
            </form>

            <div className="mt-6 border-t border-gray-100 pt-5 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="font-semibold text-[#128c7e] hover:underline"
                >
                  Sign in
                </button>
              </p>

              
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}