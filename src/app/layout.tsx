import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Investor App OTA Server",
  description: "Over-the-air update server for React Native apps",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-gray-950 text-gray-100">
        {children}
      </body>
    </html>
  );
}
