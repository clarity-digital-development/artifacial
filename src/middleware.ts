import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/studio/:path*",
    "/characters/:path*",
    "/generate/:path*",
    "/projects/:path*",
    "/gallery/:path*",
    "/settings/:path*",
    "/workshop/:path*",
    "/workshop",
    "/sign-in",
    "/sign-up",
  ],
};
