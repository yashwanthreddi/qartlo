"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const [wishlistItems, setWishlistItems] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wishlist_items");
      if (saved) {
        setWishlistItems(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Failed to load wishlist:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("wishlist_items", JSON.stringify(wishlistItems));
    } catch (error) {
      console.error("Failed to save wishlist:", error);
    }
  }, [wishlistItems]);

  const value = useMemo(() => {
    const isWishlisted = (productId) =>
      wishlistItems.some((item) => item.id === productId);

    const toggleWishlist = (product) => {
      if (!product?.id) return;

      setWishlistItems((prev) => {
        const exists = prev.some((item) => item.id === product.id);

        if (exists) {
          return prev.filter((item) => item.id !== product.id);
        }

        return [
          ...prev,
          {
            id: product.id,
            name: product.name || "",
            price: product.price || 0,
            image: product.images?.[0] || product.image || "",
            category: product.category || "",
            stock: product.stock || 0,
          },
        ];
      });
    };

    const clearWishlist = () => setWishlistItems([]);

    return {
      wishlistItems,
      isWishlisted,
      toggleWishlist,
      clearWishlist,
    };
  }, [wishlistItems]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error("useWishlist must be used inside WishlistProvider");
  }

  return context;
}