import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { CurrencyProvider } from "@/lib/currency";
import { ProfileProvider } from "@/lib/shopper-profiles";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProfileBanner } from "@/components/profiles/profile-banner";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <TRPCProvider>
          <CurrencyProvider>
            <ProfileProvider>
              <Header />
              <ProfileBanner />
              <main className="flex-1">{children}</main>
              <Footer />
            </ProfileProvider>
          </CurrencyProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
