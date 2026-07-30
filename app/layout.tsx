import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iTech PreOrder System",
  description: "Internal preorder and inventory reservation management system for iTech retail branches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
