import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { AppProviders } from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "securelink analyzer - Fear Nothing Online",
  description: "Secure, disposable container services for anonymous browsing, desktop environments, and file viewing.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AppProviders>
          <div className="min-h-screen bg-background">
            <Navbar />
            <main>{children}</main>
            <Footer />
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
