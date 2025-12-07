'use client'

import { useState } from 'react'
import { 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingBag, 
  Tag,
  CreditCard
} from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { apiClient } from '@/lib/api'
import { socketManager } from '@/lib/socket'
import toast from 'react-hot-toast'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  tableId: string
}

export default function CartDrawer({ isOpen, onClose, tableId }: CartDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [specialInstructions, setSpecialInstructions] = useState('')
  
  const { 
    items, 
    removeItem, 
    updateQuantity, 
    clearCart, 
    getTotal,
    getCartSummary,
    customerId,
    restaurantId 
  } = useCartStore()

  const handleQuantityChange = (productId: number, change: number) => {
    const item = items.find(item => item.id === productId)
    if (item) {
      const newQuantity = item.quantity + change
      if (newQuantity > 0) {
        updateQuantity(productId, newQuantity)
      } else {
        removeItem(productId)
      }
    }
  }

  const handleCheckout = async () => {
    if (items.length === 0) {
      toast.error('Giỏ hàng trống')
      return
    }

    setIsSubmitting(true)
    try {
      const orderData = {
        table_id: parseInt(tableId),
        customer_id: customerId || null,
        total_amount: getTotal(),
        status: 'pending',
        items: items.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
          special_instructions: specialInstructions
        }))
      }

      // Option 1: Use REST API
      // const result = await apiClient.createOrder(orderData)
      
      // Option 2: Use Socket.IO (real-time)
      socketManager.createOrder(orderData)
      
      toast.success('Đơn hàng đã được gửi đến bếp!')
      clearCart()
      setSpecialInstructions('')
      onClose()
      
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra khi đặt hàng')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center space-x-3">
              <ShoppingBag size={24} className="text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Giỏ hàng của bạn</h2>
                <p className="text-sm text-gray-500">Bàn {tableId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Đóng giỏ hàng"
            >
              <X size={24} />
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-6">
            {items.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag size={64} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Giỏ hàng trống</p>
                <p className="text-sm text-gray-400 mt-2">Hãy thêm món ăn từ menu</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">{item.category}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleQuantityChange(item.id, -1)}
                            className="p-1 hover:bg-gray-200 rounded"
                            aria-label="Giảm số lượng"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(item.id, 1)}
                            className="p-1 hover:bg-gray-200 rounded"
                            aria-label="Tăng số lượng"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="font-semibold">
                            {(item.price * item.quantity).toLocaleString()}đ
                          </span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                            aria-label="Xóa món"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Special Instructions */}
            {items.length > 0 && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ghi chú đặc biệt cho bếp
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Ví dụ: ít cay, không hành, nấu chín kỹ..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t p-6">
              {/* Promo Code */}
              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Tag size={18} className="text-gray-500" />
                  <span className="text-sm text-gray-600">Mã giảm giá</span>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Nhập mã giảm giá"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <button className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
                    Áp dụng
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tạm tính</span>
                  <span>{getTotal().toLocaleString()}đ</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Giảm giá</span>
                  <span className="text-green-600">-0đ</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Phí dịch vụ (10%)</span>
                  <span>{(getTotal() * 0.1).toLocaleString()}đ</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Tổng cộng</span>
                  <span className="text-blue-600">
                    {(getTotal() * 1.1).toLocaleString()}đ
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={20} />
                      <span>Thanh toán ngay</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    if (confirm('Bạn có chắc muốn xóa tất cả món trong giỏ?')) {
                      clearCart()
                      toast.success('Đã xóa giỏ hàng')
                    }
                  }}
                  className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Xóa giỏ hàng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}