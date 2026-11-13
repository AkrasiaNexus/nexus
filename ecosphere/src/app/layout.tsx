import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geist = localFont({ src: "./fonts/GeistVF.woff", variable: "--font-geist-sans", weight: "100 900" });

export const metadata: Metadata = {
  title: "EcoSphere AI",
  description: "AI-powered waste sorting, recycling guidance and circular-economy rewards for schools, homes and communities (SDG 12).",
};
export const viewport: Viewport = { themeColor: "#040b06", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased`}>
        <main className="mx-auto min-h-screen max-w-md">{children}</main>
      </body>
    </html>
  );
}
