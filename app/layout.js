import "./globals.css";

export const metadata = {
  title: "Firma CRM",
  description: "Interni CRM — potencijali, lidovi, kupci i tehnička podrška",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bs">
      <body>{children}</body>
    </html>
  );
}
