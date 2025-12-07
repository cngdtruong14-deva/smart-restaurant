const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const axios = require('axios');

class AIController {
  static async getRecommendations(req, res) {
    try {
      const { customerId, tableId, restaurantId } = req.query;

      // Get customer history
      const [orders] = await pool.execute(
        `SELECT oi.product_id, COUNT(*) as order_count
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         WHERE o.customer_id = ?
         GROUP BY oi.product_id
         ORDER BY order_count DESC
         LIMIT 10`,
        [customerId]
      );

      // Get popular items
      const popularProducts = await Product.getPopularProducts(restaurantId, 10);

      // Get trending items (last 7 days)
      const [trending] = await pool.execute(
        `SELECT oi.product_id, COUNT(*) as recent_orders
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         WHERE o.restaurant_id = ? 
         AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY oi.product_id
         ORDER BY recent_orders DESC
         LIMIT 5`,
        [restaurantId]
      );

      // Combine recommendations with AI scoring
      const recommendations = {
        based_on_history: orders.map(o => ({
          product_id: o.product_id,
          reason: 'Dựa trên lịch sử đặt món của bạn'
        })),
        popular_items: popularProducts.map(p => ({
          product_id: p.id,
          name: p.name,
          reason: 'Món được yêu thích nhất nhà hàng'
        })),
        trending_now: trending.map(t => ({
          product_id: t.product_id,
          reason: 'Đang thịnh hành tuần này'
        })),
        vip_exclusive: customerSegment === 'vip' ? [
          { product_id: 'special_item_id', reason: 'Đặc sản dành riêng cho VIP' }
        ] : []
      };

      res.json({
        success: true,
        data: recommendations,
        customer_segment: customerSegment
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async generateDynamicCombo(req, res) {
    try {
      const { restaurantId, maxPrice, preferences } = req.body;

      // Get products with good profit margin
      const [comboCandidates] = await pool.execute(
        `SELECT p.*, 
         (p.price - p.cost_price) / p.price as profit_margin,
         AVG(r.rating) as avg_rating
         FROM products p
         LEFT JOIN reviews r ON p.id = r.product_id
         WHERE p.restaurant_id = ? 
         AND p.is_available = true
         AND p.price <= ?
         GROUP BY p.id
         HAVING profit_margin > 0.3
         ORDER BY avg_rating DESC, profit_margin DESC
         LIMIT 10`,
        [restaurantId, maxPrice * 0.4]
      );

      // AI algorithm to create optimal combo
      const combos = this.createOptimalCombos(comboCandidates, maxPrice);

      res.json({
        success: true,
        combos,
        total_generated: combos.length,
        estimated_savings: `15-25%`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async predictDemand(req, res) {
    try {
      const { restaurantId, date } = req.body;

      // Get historical data for prediction
      const [historicalData] = await pool.execute(
        `SELECT 
          DATE(o.created_at) as date,
          HOUR(o.created_at) as hour,
          DAYNAME(o.created_at) as day_name,
          COUNT(*) as order_count,
          SUM(o.total_amount) as revenue,
          AVG(o.total_amount) as avg_order_value
         FROM orders o
         WHERE o.restaurant_id = ?
         AND o.created_at >= DATE_SUB(?, INTERVAL 90 DAY)
         GROUP BY DATE(o.created_at), HOUR(o.created_at)
         ORDER BY date, hour`,
        [restaurantId, date]
      );

      // Send to AI model for prediction
      const aiResponse = await axios.post(process.env.AI_MODEL_ENDPOINT, {
        historical_data: historicalData,
        prediction_date: date
      });

      res.json({
        success: true,
        predictions: aiResponse.data.predictions,
        confidence_score: aiResponse.data.confidence,
        recommendations: aiResponse.data.recommendations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static createOptimalCombos(products, maxPrice) {
    // Knapsack algorithm for optimal combo creation
    const n = products.length;
    const dp = Array(n + 1).fill().map(() => Array(Math.floor(maxPrice) + 1).fill(0));
    
    for (let i = 1; i <= n; i++) {
      for (let w = 1; w <= maxPrice; w++) {
        if (products[i-1].price <= w) {
          dp[i][w] = Math.max(
            dp[i-1][w],
            dp[i-1][w - Math.floor(products[i-1].price)] + 
            (products[i-1].profit_margin * 100)
          );
        } else {
          dp[i][w] = dp[i-1][w];
        }
      }
    }

    // Backtrack to find combo items
    let w = maxPrice;
    const comboItems = [];
    for (let i = n; i > 0 && w > 0; i--) {
      if (dp[i][w] !== dp[i-1][w]) {
        comboItems.push(products[i-1]);
        w -= Math.floor(products[i-1].price);
      }
    }

    // Create combo packages
    const combos = [{
      name: `Combo Tiết Kiệm ${Math.floor(maxPrice * 0.85)}đ`,
      items: comboItems,
      original_price: comboItems.reduce((sum, item) => sum + item.price, 0),
      combo_price: Math.floor(comboItems.reduce((sum, item) => sum + item.price, 0) * 0.85),
      savings_percent: 15,
      description: 'Tiết kiệm 15% so với đặt riêng lẻ'
    }];

    return combos;
  }
}

module.exports = AIController;