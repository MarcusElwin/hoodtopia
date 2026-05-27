import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { CurrencyProvider } from "@/lib/currency";
import { ProfileProvider } from "@/lib/shopper-profiles";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProfileBanner } from "@/components/profiles/profile-banner";
import { DemoBanner } from "@/components/layout/demo-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hoodtopia | AI-Powered Hoodie Shop",
  description:
    "Find your perfect hoodie with AI-powered recommendations. Agentic commerce demo for LangChain Stockholm Meetup.",
};

// Snippet from https://docs.kustom.co/contents/checkout/kustom-elements/integration-guide/installation
// Inline initialiser the loader expects to find on window before pre-load.js
// resolves. Without it custom element tags never get upgraded.
const KUSTOM_ELEMENTS_INIT = `(function (w) {
  ((window.kustomElements =
    window.kustomElements ||
    function (w, ...n) {
      return new Promise((o, i) => {
        window.kustomElements._internal.q.push({
          method: w,
          args: n,
          resolve: o,
          reject: i,
        });
      });
    }),
    (window.kustomElements._internal = window.kustomElements
      ._internal || { q: [], snippetVersion: "1.0.0" }),
    window.kustomElements.load ||
      (window.kustomElements.load = new Promise((w, n) => {
        ((window.kustomElements._internal.loadResolve = w),
          (window.kustomElements._internal.loadReject = n));
      })));
})(window);`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Two env vars (both NEXT_PUBLIC_, both safe to expose):
  //   _SRC = full URL to pre-load.js (Playground or Live, copied from Portal)
  //   _API_KEY = the data-public-api-key embedded in the snippet
  // The Portal hands you both as part of the install snippet.
  const elementsSrc = process.env.NEXT_PUBLIC_KUSTOM_ELEMENTS_SRC;
  const elementsKey = process.env.NEXT_PUBLIC_KUSTOM_ELEMENTS_API_KEY;
  const elementsEnabled = Boolean(elementsSrc && elementsKey);
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        {elementsEnabled ? (
          <>
            <Script
              id="kustom-elements-script"
              src={elementsSrc}
              strategy="beforeInteractive"
              data-public-api-key={elementsKey}
            />
            <Script
              id="kustom-elements-init"
              strategy="beforeInteractive"
              dangerouslySetInnerHTML={{ __html: KUSTOM_ELEMENTS_INIT }}
            />
          </>
        ) : null}
        <TRPCProvider>
          <CurrencyProvider>
            <ProfileProvider>
              <DemoBanner />
              <Header />
              <ProfileBanner />
              <main className="flex-1">{children}</main>
              <Footer />
            </ProfileProvider>
          </CurrencyProvider>
        </TRPCProvider>
        <Analytics />
      </body>
    </html>
  );
}
