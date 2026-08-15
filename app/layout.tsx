import type { Metadata } from "next";
import "./globals.css";
import "./admin/admin.css";
import PublicFooter from "../components/PublicFooter";

export const metadata: Metadata = {
  title: "Galletísima | Moldes que convierten ideas en galletas increíbles",
  description: "Moldes únicos y personalizados para crear galletas inolvidables. Envíos a todo Chile.",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}<PublicFooter /></body></html>;
}
