import { NextResponse } from "next/server";

export function proxy(request) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  const rawHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.hostname ||
    "";

  const hostname = rawHost.split(":")[0].toLowerCase().trim();

  // Ignore Next.js internal files, API routes, and public files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Firebase admin/app domain
  if (hostname === "app.qartlo.com") {
    if (pathname === "/") {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // All other domains are customer custom domains
  url.pathname = `/custom-domain/${hostname}${pathname}`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};