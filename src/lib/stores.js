import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";

export function cleanCustomDomain(value = "") {
  return String(value || "")
    .replace("https://", "")
    .replace("http://", "")
    .split("/")[0]
    .toLowerCase()
    .trim();
}

export function cleanStoreSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function getStoreBySlug(storeSlug) {
  const cleanSlug = cleanStoreSlug(storeSlug);

  if (!cleanSlug) {
    return null;
  }

  const storesRef = collection(db, "stores");

  const q = query(
    storesRef,
    where("slug", "==", cleanSlug),
    where("isActive", "==", true),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  };
}

export async function getStoreByCustomDomain(domain) {
  const cleanDomain = cleanCustomDomain(domain);

  if (!cleanDomain) {
    return null;
  }

  const storesRef = collection(db, "stores");

  const q = query(
    storesRef,
    where("customDomains", "array-contains", cleanDomain),
    where("isActive", "==", true),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  };
}

export async function getStoreBySlugOrDomain(value) {
  const cleanValue = cleanCustomDomain(value);

  if (!cleanValue) {
    return null;
  }

  if (cleanValue.includes(".")) {
    return getStoreByCustomDomain(cleanValue);
  }

  return getStoreBySlug(cleanValue);
}