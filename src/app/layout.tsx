import type { Metadata } from "next";
import "@xterm/xterm/css/xterm.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hermes Platform",
  description: "Create Hermes agents and provision shared DigitalOcean workers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
