'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ShoppingCart, 
  Home, 
  Clock, 
  User, 
  Filter, 
  Search,
  Sparkles,
  Bell
} from 'lucide-react'
import MenuGrid from '@/components/customer/MenuGrid'
import CartDrawer from '@/components/customer/CartDrawer'
import { useCartStore } from '@/store/cartStore'
import { socketManager } from '@/lib/socket'
import toast from 'react-hot-toast'
import { apiClient } from '@/lib/api'

export default function MenuPage() {
  const params = useParams()
  const router = useRouter()
  const tableId = params.tableId as string
  
  const [tableInfo, setTableInfo] = useState<any>(null)
  const [showCart, setShowCart] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  
  const itemCount = useCartStore((state) => state.getItemCount())
  const setTableId = useCartStore((state) => state.setTableId)

  useEffect(() => {
    if (!tableId) return

    // Set table ID in store
    setTableId(tableId)

    // Fetch table info
    const fetchTableInfo = async () => {
      try {
        setLoading(true)
        const data = await apiClient.getTable(tableId)
        setTableInfo(data.data)
        
        // Connect socket
        socketManager.connect()
        socketManager.joinTable(tableId)
        
        // Listen for order updates
        socketManager.onOrderStatusUpdated((order) => {
          if (order.table_id === tableId) {
            toast.success(`Đơn hàng #${order.id} đã được cập nhật: ${order.status}`)
          }
        })
        
      } catch (error) {
        toast.error('Không tìm thấy bàn này')
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    fetchTableInfo()

    // Cleanup
    return () => {
      socketManager.leaveTable(tableId)
      socketManager.offOrderCreated(() => {})
      socketManager.offOrderStatusUpdated(() => {})
    }
  }, [tableId, router, setTableId])

  const callStaff = () => {
    socketManager.callStaff(tableId, 'Yêu cầu hỗ trợ')
    toast.success('Đã gọi nhân viên phục vụ')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải thông tin bàn...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Quay lại trang chủ"
              >
                <Home size={24} />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="font-bold text-lg">Bàn {tableInfo?.table_number}</h1>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    tableInfo?.status === 'available' 
                      ? 'bg-green-100 text-green-800'
                      : tableInfo?.status === 'occupied'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {tableInfo?.status === 'available' ? 'Trống' : 
                     tableInfo?.status === 'occupied' ? 'Đang dùng' : 'Đã đặt'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Sức chứa: {tableInfo?.capacity} người</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Tìm món ăn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>

              {/* AI Recommendations */}
              <button
                onClick={() => toast.success('Tính năng AI đang phát triển')}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Sparkles size={18} />
                <span className="hidden md:inline">Đề xuất AI</span>
              </button>

              {/* Track Orders */}
              <button
                onClick={() => router.push(`/order/${tableId}`)}
                className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors"
              >
                <Clock size={20} />
                <span className="hidden md:inline">Theo dõi đơn</span>
              </button>

              {/* Call Staff */}
              <button
                onClick={callStaff}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
                aria-label="Gọi nhân viên"
              >
                <Bell size={24} />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
              </button>

              {/* Cart */}
              <button
                onClick={() => setShowCart(true)}
                className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Giỏ hàng"
              >
                <ShoppingCart size={24} />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
                    {itemCount}
                  </span>
                )}
              </button>

              {/* Customer Profile */}
              <button
                onClick={() => toast('Tính năng đang phát triển')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Tài khoản"
              >
                <User size={24} />
              </button>
            </div>
          </div>

          {/* Mobile Search */}
          <div className="mt-4 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Tìm món ăn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Category Filter */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center space-x-4 overflow-x-auto pb-2">
          <span className="text-gray-700 font-medium whitespace-nowrap">
            <Filter size={18} className="inline mr-2" />
            Danh mục:
          </span>
          {['all', 'Món chính', 'Món phụ', 'Đồ uống', 'Tráng miệng', 'Combo'].map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category === 'all' ? 'Tất cả' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <MenuGrid 
          tableId={tableId}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
        />
      </main>

      {/* Cart Drawer */}
      <CartDrawer 
        isOpen={showCart} 
        onClose={() => setShowCart(false)} 
        tableId={tableId}
      />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col space-y-3">
        <button
          onClick={callStaff}
          className="bg-red-500 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Gọi nhân viên"
        >
          <Bell size={24} />
        </button>
        <button
          onClick={() => setShowCart(true)}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-shadow relative"
          aria-label="Giỏ hàng"
        >
          <ShoppingCart size={24} />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}