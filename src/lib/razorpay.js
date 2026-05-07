export function loadRazorpayScript() {
  return new Promise((resolve) => {
    // 🔥 SSR safety (important for Next.js)
    if (typeof window === "undefined" || typeof document === "undefined") {
      resolve(false);
      return;
    }

    // 🔥 If already loaded
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    // 🔥 If script already exists
    const existingScript = document.getElementById(
      "razorpay-checkout-script"
    );

    if (existingScript) {
      existingScript.onload = () => resolve(true);
      existingScript.onerror = () => resolve(false);
      return;
    }

    // 🔥 Create script
    const script = document.createElement("script");
    script.id = "razorpay-checkout-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("Razorpay SDK failed to load");
      resolve(false);
    };

    document.body.appendChild(script);
  });
}