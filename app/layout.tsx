import type { Metadata } from "next";
import "./globals.css";
import "./admin/admin.css";

export const metadata: Metadata = {
  title: "Galletísima | Moldes que convierten ideas en galletas increíbles",
  description: "Moldes únicos y personalizados para crear galletas inolvidables. Envíos a todo Chile.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
