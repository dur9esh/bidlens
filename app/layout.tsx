import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display-serif",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-body-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BidLens — Agentic AI bid evaluation",
  description:
    "BidLens ingests RFPs and vendor bids, runs specialized AI evaluators, and produces a defensible scorecard, memo, and risk register.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${ibmPlexSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
