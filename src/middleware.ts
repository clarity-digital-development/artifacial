// AUTH TEMPORARILY DISABLED FOR UX WORK — re-enable before shipping
// import NextAuth from "next-auth";
// import { authConfig } from "@/lib/auth.config";
// export default NextAuth(authConfig).auth;

import { NextRequest, NextResponse } from "next/server";
export default function middleware(req: NextRequest) {
  // Redirect auth pages straight to dashboard during UX work
  if (req.nextUrl.pathname === "/sign-in" || req.nextUrl.pathname === "/sign-up") {
    return NextResponse.redirect(new URL("/studio", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/studio/:path*",
    "/characters/:path*",
    // "/generate/:path*",
    "/projects/:path*",
    "/gallery/:path*",
    "/settings/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
