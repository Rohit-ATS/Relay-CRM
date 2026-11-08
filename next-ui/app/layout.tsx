import "./globals.css";
import "./landing.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Relay — CRM that moves with your sales",
  description:
    "AI-native B2B CRM for founder-led outbound workflows. Turn lead lists into connected CRM records, approved outreach plans, and clear human handoffs.",
  keywords: [
    "CRM",
    "AI-native CRM",
    "founder-led sales",
    "lead ingestion",
    "outbound sequences",
    "workflow automation",
  ],
  authors: [{ name: "Relay CRM" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Relay — CRM that moves with your sales",
    description:
      "Turn lead lists into connected CRM records, approved outreach plans, and clear human handoffs. AI-native CRM for founder-led sales teams.",
    siteName: "Relay CRM",
    type: "website",
    images: [
      {
        url: "https://relay-crm-api.onrender.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Relay CRM — AI-native B2B sales workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Relay — CRM that moves with your sales",
    description:
      "Turn lead lists into connected CRM records, approved outreach plans, and clear human handoffs. AI-native CRM for founder-led sales teams.",
    images: ["https://relay-crm-api.onrender.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
