// src/middleware.js

import { NextResponse } from "next/server";

export function middleware(request) {
  const url = request.nextUrl;
  const host = request.headers.get("host") || "";

  const hostname = host.replace(":3000", "").toLowerCase().trim();

  const mainDomains = [
    "qartlo.com",
    "www.qartlo.com",
    "app.qartlo.com",
    "localhost",
  ];

  // Normal Qartlo routes should work as usual
  if (mainDomains.includes(hostname)) {
    return NextResponse.next();
  }

  // Ignore API routes, Next files, favicon, and static assets
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/favicon.ico") ||
    url.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Example:
  // shop.ambica.com          -> /shop.ambica.com
  // shop.ambica.com/checkout -> /shop.ambica.com/checkout
  url.pathname = `/${hostname}${url.pathname}`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};