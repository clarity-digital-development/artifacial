import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/studio/:path*",
    "/characters/:path*",
    "/projects/:path*",
    "/gallery/:path*",
    "/settings/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
