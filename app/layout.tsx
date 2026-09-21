import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiskalni Inbox",
  description: "Digitalni inbox fiskalnih računa za firme i knjigovođe."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
