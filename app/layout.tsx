import "./globals.css";
import "./landing.css";
import type { Metadata } from "next";
export const metadata:Metadata={title:"Relay — CRM that moves with your sales",description:"Turn lead lists into connected CRM records, approved outreach plans, and clear human handoffs."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
