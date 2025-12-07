import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { SocketProvider } from '@/components/providers/SocketProvider'

const inter = Inter({ subsets: ['latin', 'vietnamese'] })

export const metadata: Metadata = {
  title: 'Smart Restaurant - Hệ thống gọi món thông minh',
  description: 'Gọi món không tiếp xúc qua QR code, tích hợp AI và Big Data',
  keywords: 'nhà hàng thông minh, QR code, gọi món, AI, Big Data',
  authors: [{ name: 'Smart Restaurant Team' }],
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: 'https://restaurant.yourdomain.com',
    title: 'Smart Restaurant',
    description: 'Hệ thống gọi món thông minh qua QR code',
    siteName: 'Smart Restaurant',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <QueryProvider>
          <SocketProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10B981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 4000,
                  iconTheme: {
                    primary: '#EF4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </SocketProvider>
        </QueryProvider>
      </body>
    </html>
  )
}