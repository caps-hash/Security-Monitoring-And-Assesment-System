import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Security Personnel Assessment System",
    template: "%s | Security Personnel Assessment System",
  },
  description:
    "Security personnel assessment and monitoring for Global Ground Force Security Agency Inc.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
