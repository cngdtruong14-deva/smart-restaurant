'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock, ChefHat } from 'lucide-react';
import socketClient from '@/lib/socket';
import { apiClient } from '@/lib/api';

interface KitchenOrder {
  id: number;
  table_number: string;
  items: Array<{
    name: string;
    quantity: number;
    notes?: string;
  }>;
  status: 'pending' | 'preparing' | 'ready' | 'served';
  created_at: string;
}

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    // Load initial orders
    loadOrders();

    // Setup socket connection
    const socket = socketClient.connect();
    socketClient.joinKitchen();

    // Listen for new orders
    socketClient.onNewOrder((newOrder) => {
      setOrders(prev => [newOrder, ...prev]);
      
      // Play sound notification
      if (soundEnabled) {
        playNotificationSound();
      }
    });

    return () => {
      socketClient.off('kitchen:new_order');
    };
  }, [soundEnabled]);

  const loadOrders = async () => {
    try {
      const response = await apiClient.getKitchenOrders();
      setOrders(response.data.data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(console.error);
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      await apiClient.updateOrderStatus(orderId, status);
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId ? { ...order, status } : order
        )
      );
    } catch (error) {
      console.error('Failed to update order:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'served': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5" />;
      case 'preparing': return <ChefHat className="w-5 h-5" />;
      case 'ready': return <CheckCircle className="w-5 h-5" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Màn hình bếp</h1>
          <p className="text-gray-600">
            Cập nhật đơn hàng thời gian thực
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-4 py-2 rounded-lg ${soundEnabled ? 'bg-green-500' : 'bg-gray-300'} text-white`}
          >
            {soundEnabled ? '🔔 Âm thanh: Bật' : '🔕 Âm thanh: Tắt'}
          </button>
          <button
            onClick={loadOrders}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Làm mới
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-3xl font-bold text-yellow-600">
            {orders.filter(o => o.status === 'pending').length}
          </div>
          <div className="text-gray-600">Chờ xử lý</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-3xl font-bold text-blue-600">
            {orders.filter(o => o.status === 'preparing').length}
          </div>
          <div className="text-gray-600">Đang chế biến</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-3xl font-bold text-green-600">
            {orders.filter(o => o.status === 'ready').length}
          </div>
          <div className="text-gray-600">Sẵn sàng phục vụ</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-3xl font-bold text-gray-600">
            {orders.length}
          </div>
          <div className="text-gray-600">Tổng số đơn</div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Order Header */}
            <div className="bg-gray-800 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xl font-bold">Bàn {order.table_number}</div>
                  <div className="text-sm opacity-80">
                    {new Date(order.created_at).toLocaleTimeString('vi-VN')}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full flex items-center ${getStatusColor(order.status)}`}>
                  {getStatusIcon(order.status)}
                  <span className="ml-2 capitalize">{order.status}</span>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="p-4">
              <div className="space-y-3 mb-4">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-start border-b pb-2">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      {item.notes && (
                        <div className="text-sm text-gray-500 italic">Ghi chú: {item.notes}</div>
                      )}
                    </div>
                    <div className="font-bold">x{item.quantity}</div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                    className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                  >
                    Bắt đầu chế biến
                  </button>
                )}
                
                {order.status === 'preparing' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'ready')}
                    className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
                  >
                    Hoàn thành
                  </button>
                )}
                
                {order.status === 'ready' && (
                  <button
                    onClick={(): Promise<void> => updateOrderStatus(order.id, 'served')}
                    className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                  >
                    Đã phục vụ
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="col-span-full text-center py-12">
            <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-600">Không có đơn hàng nào</h3>
            <p className="text-gray-500">Đơn hàng mới sẽ xuất hiện tại đây</p>
          </div>
        )}
      </div>
    </div>
  );
}