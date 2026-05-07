"use client";

import { useAuthContext } from "@/context/AuthContext";

export default function useAuth() {
  const context = useAuthContext();

  // extra safety (optional but production-safe)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}