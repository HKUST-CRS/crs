import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ClientServerUrlProvider } from "@/lib/client-server-url-provider";
import { TRPCReactProvider } from "@/lib/trpc-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CSE Request System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Due to Next.js's prerendering, this is undefined at build time.
  // So it is default to an empty string. But in run time it should be defined.
  const CLIENT_SERVER_URL = process.env.CLIENT_SERVER_URL ?? "";
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <ClientServerUrlProvider url={CLIENT_SERVER_URL}>
            <TRPCReactProvider>
              {children}
              <Toaster position="top-center" richColors />
            </TRPCReactProvider>
          </ClientServerUrlProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
