'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, TrendingUp, Users, Clock, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIRecommendationsProps {
  tableId: string;
  onClose: () => void;
}

export default function AIRecommendations({ tableId, onClose }: AIRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAIRecommendations();
  }, [tableId]);

  const fetchAIRecommendations = async () => {
    try {
      const customerId = localStorage.getItem('customerId');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai/recommendations?tableId=${tableId}&customerId=${customerId}`
      );
      const data = await response.json();
      setRecommendations(data);
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Đề xuất AI thông minh</h2>
                  <p className="opacity-90">
                    Dựa trên sở thích của bạn và 5,000+ đơn hàng khác
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : recommendations ? (
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Customer Insights */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Users className="mr-2" size={20} />
                  Phân tích khách hàng
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-xl">
                    <div className="text-sm text-blue-700 mb-1">Phân khúc</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {recommendations.customer_segment?.toUpperCase()}
                    </div>
                    <div className="text-xs text-blue-600 mt-2">
                      {recommendations.customer_segment === 'vip' && 'Ưu tiên phục vụ & quà tặng đặc biệt'}
                      {recommendations.customer_segment === 'regular' && 'Khách hàng thân thiết'}
                      {recommendations.customer_segment === 'new' && 'Chào mừng khách mới!'}
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-xl">
                    <div className="text-sm text-purple-700 mb-1">Đề xuất phù hợp</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {recommendations.match_percentage}%
                    </div>
                    <div className="text-xs text-purple-600 mt-2">
                      Dựa trên lịch sử đặt hàng và sở thích tương tự
                    </div>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-xl">
                    <div className="text-sm text-green-700 mb-1">Thời điểm tối ưu</div>
                    <div className="text-2xl font-bold text-green-900">
                      {new Date().getHours()}:00
                    </div>
                    <div className="text-xs text-green-600 mt-2">
                      Giờ cao điểm - đề xuất món nhanh
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendation Types */}
              <div className="space-y-6">
                {/* Based on History */}
                {recommendations.based_on_history?.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Clock className="mr-2" size={20} />
                      Dựa trên lịch sử của bạn
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recommendations.based_on_history.map((rec: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-gray-50 p-4 rounded-xl border border-gray-200"
                        >
                          <div className="font-medium">{rec.product_name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {rec.reason}
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Đã đặt {rec.previous_orders} lần
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Popular Items */}
                {recommendations.popular_items?.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <TrendingUp className="mr-2" size={20} />
                      Đang thịnh hành
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {recommendations.popular_items.map((rec: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-orange-50 p-4 rounded-xl border border-orange-200"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{rec.product_name}</div>
                              <div className="text-sm text-orange-600 mt-1">
                                {rec.reason}
                              </div>
                            </div>
                            <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2 py-1 rounded">
                              #{idx + 1}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            {rec.order_count} đơn/tuần • ⭐ {rec.rating}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Dynamic Combos */}
                {recommendations.dynamic_combos?.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Tag className="mr-2" size={20} />
                      Combo AI tiết kiệm
                    </h3>
                    <div className="space-y-4">
                      {recommendations.dynamic_combos.map((combo: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200"
                        >
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <div className="font-bold text-lg">{combo.name}</div>
                              <div className="text-sm text-green-700">
                                Tiết kiệm {combo.savings_percent}% • {combo.items.length} món
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-900">
                                {combo.combo_price.toLocaleString()}đ
                              </div>
                              <div className="text-sm text-gray-500 line-through">
                                {combo.original_price.toLocaleString()}đ
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 mb-3">
                            {combo.description}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {combo.items.map((item: string, itemIdx: number) => (
                              <span
                                key={itemIdx}
                                className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                          <button className="mt-4 w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity">
                            Chọn Combo Này
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">Không có đề xuất nào vào lúc này</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}