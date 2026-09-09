import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata = {
  title: "Strojotehnika CRM",
  description: "Interni CRM — potencijali, lidovi, kupci i tehnička podrška",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bs">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
