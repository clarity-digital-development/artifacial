import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAuth = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname.startsWith("/sign-in") ||
        nextUrl.pathname.startsWith("/sign-up");
      const isAppRoute =
        nextUrl.pathname.startsWith("/studio") ||
        nextUrl.pathname.startsWith("/characters") ||
        nextUrl.pathname.startsWith("/projects") ||
        nextUrl.pathname.startsWith("/gallery") ||
        nextUrl.pathname.startsWith("/settings");

      if (isAppRoute && !isAuth) {
        return false; // redirects to signIn page
      }

      if (isAuthPage && isAuth) {
        return Response.redirect(new URL("/studio", nextUrl));
      }

      return true;
    },
  },
};
