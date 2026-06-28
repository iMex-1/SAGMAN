import { NextRequest, NextResponse } from "next/server";

// Paths that don't require a token
const PUBLIC_PATHS = ["/login", "/portal"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths and everything under /portal
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Allow Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for the auth cookie (set by authStorage.setTokens after login)
  const token = request.cookies.get("sagman_token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude: Next.js internals, static files, AND /api/v1/* (proxied to Fastify via rewrites)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/v1).*)"],
};
