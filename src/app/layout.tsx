import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { DM_Sans, Goldman } from "next/font/google";
import { Providers } from "@/components/providers";
import { PostHogProvider } from "@/components/posthog-provider";
import "./globals.css";

const goldman = Goldman({
  variable: "--font-goldman",
  subsets: ["latin"],
  weight: ["700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Artifacial — AI Character & Video Studio",
  description:
    "Create persistent AI characters and generate short-form videos with per-scene editing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${goldman.variable} ${dmSans.variable} antialiased`}
      >
        <Providers>
          <Suspense fallback={null}>
            <PostHogProvider>{children}</PostHogProvider>
          </Suspense>
        </Providers>
        <Script id="rewardful-queue" strategy="beforeInteractive">
          {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
        </Script>
        <Script src="https://r.wdfl.co/rw.js" data-rewardful="a780df" strategy="afterInteractive" />
      </body>
    </html>
  );
}
