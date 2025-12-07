'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, QrCode, Users, Clock, Sparkles } from 'lucide-react'
import dynamic from 'next/dynamic'
import toast from 'react-hot-toast'

// Dynamically import QR scanner to avoid SSR issues
const QRScanner = dynamic(() => import('@/components/customer/QRScanner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  ),
})

export default function HomePage() {
  const router = useRouter()
  const [showScanner, setShowScanner] = useState(false)
  const [manualTableId, setManualTableId] = useState('')

  const handleScan = (data: string) => {
    try {
      const qrData = JSON.parse(data)
      if (qrData.table_id && qrData.table_number) {
        toast.success(`Đã quét bàn ${qrData.table_number}`)
        router.push(`/menu/${qrData.table_id}`)
      }
    } catch (error) {
      // If it's a simple table ID
      if (data.startsWith('table_')) {
        const tableId = data.replace('table_', '')
        router.push(`/menu/${tableId}`)
      }
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualTableId.trim()) {
      router.push(`/menu/${manualTableId.trim()}`)
    }
  }

  const features = [
    {
      icon: QrCode,
      title: 'Quét QR nhanh chóng',
      description: 'Quét mã QR trên bàn để bắt đầu gọi món',
    },
    {
      icon: Users,
      title: 'Phục vụ không tiếp xúc',
      description: 'Giảm tiếp xúc, tăng an toàn và tiện lợi',
    },
    {
      icon: Clock,
      title: 'Thời gian thực',
      description: 'Theo dõi đơn hàng và nhận thông báo tức thì',
    },
    {
      icon: Sparkles,
      title: 'Đề xuất thông minh',
      description: 'AI đề xuất món ăn phù hợp với sở thích của bạn',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Chào mừng đến với{' '}
            <span className="text-blue-600">Smart Restaurant</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Trải nghiệm ẩm thực thông minh với công nghệ QR code và AI
          </p>
        </div>

        {/* QR Scanner Section */}
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-6 mb-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
              <Camera className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Quét mã QR để bắt đầu
            </h2>
            <p className="text-gray-600">
              Đưa camera vào mã QR trên bàn để mở menu và gọi món
            </p>
          </div>

          {showScanner ? (
            <QRScanner onScan={handleScan} />
          ) : (
            <div className="text-center">
              <button
                onClick={() => setShowScanner(true)}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-lg font-semibold hover:opacity-90 transition-opacity shadow-lg hover:shadow-xl"
              >
                Bắt đầu quét QR
              </button>
            </div>
          )}

          {/* Manual Input */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-center text-gray-500 mb-4">
              Hoặc nhập mã bàn thủ công
            </p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualTableId}
                onChange={(e) => setManualTableId(e.target.value)}
                placeholder="Nhập mã bàn (VD: T01)"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
              >
                Xác nhận
              </button>
            </form>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                <feature.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Cách thức hoạt động
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Quét mã QR',
                description: 'Quét mã QR trên bàn bằng điện thoại',
              },
              {
                step: '2',
                title: 'Chọn món',
                description: 'Xem menu và chọn món yêu thích',
              },
              {
                step: '3',
                title: 'Theo dõi đơn hàng',
                description: 'Xem trạng thái đơn hàng thời gian thực',
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  {item.step}
                </div>
                <div className="pt-8 p-6 bg-white rounded-xl shadow-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg font-semibold mb-2">Smart Restaurant</p>
          <p className="text-gray-400">Hệ thống gọi món thông minh qua QR code</p>
          <div className="mt-4 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} Smart Restaurant. All rights reserved.</p>
            <p className="mt-1">Liên hệ: support@smartrestaurant.com | Hotline: 1900 1234</p>
          </div>
        </div>
      </footer>
    </div>
  )
}