import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import CrmNavigation from '@/components/layout/crm-navigation'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'CRM "VILLAGE WINE"',
  description: 'CRM готелю Village Wine',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CrmNavigation />
        {children}
      </body>
    </html>
  )
}
