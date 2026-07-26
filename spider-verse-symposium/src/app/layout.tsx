import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "XPLORE'26 | Where Dimensions Collide",
  description:
    "Cross dimensions and join XPLORE'26 — a convergence of innovators, creators, and visionaries pushing the boundaries of technology and creativity.",
  keywords: ["XPLORE", "Symposium", "Conference", "Innovation", "Technology", "Spider-Verse"],
  openGraph: {
    title: "XPLORE'26 | Where Dimensions Collide",
    description:
      "Cross dimensions and join XPLORE'26 — a convergence of innovators, creators, and visionaries.",
    type: "website",
  },
};

/** `themeColor` moved out of `metadata`: this Next version only honours it in
 *  a `viewport` export and warns on every build otherwise. */
export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#0A0A0A] text-[#F2EFE9] font-[var(--font-body)]">
        {/* Global noise overlay */}
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
