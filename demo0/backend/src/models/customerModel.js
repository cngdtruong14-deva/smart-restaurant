const { pool } = require('../config/database');

class Customer {
  static async createOrUpdate(customerData) {
    // Check if customer exists by phone or email
    const [existing] = await pool.execute(
      `SELECT * FROM customers 
       WHERE phone = ? OR email = ?`,
      [customerData.phone, customerData.email]
    );

    if (existing.length > 0) {
      // Update existing customer
      const [result] = await pool.execute(
        `UPDATE customers SET
         name = COALESCE(?, name),
         email = COALESCE(?, email),
         total_visits = total_visits + 1,
         total_spent = total_spent + ?,
         last_visit = NOW(),
         updated_at = NOW()
         WHERE id = ?`,
        [
          customerData.name,
          customerData.email,
          customerData.total_spent || 0,
          existing[0].id
        ]
      );
      return existing[0].id;
    } else {
      // Create new customer
      const [result] = await pool.execute(
        `INSERT INTO customers 
        (name, phone, email, segment, total_visits, total_spent, first_visit) 
        VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          customerData.name,
          customerData.phone,
          customerData.email,
          'new',
          1,
          customerData.total_spent || 0
        ]
      );
      return result.insertId;
    }
  }

  static async autoSegmentCustomer(customerId) {
    const [customer] = await pool.execute(
      `SELECT 
        total_visits,
        total_spent,
        DATEDIFF(NOW(), first_visit) as days_since_first_visit,
        DATEDIFF(NOW(), last_visit) as days_since_last_visit
       FROM customers WHERE id = ?`,
      [customerId]
    );

    if (!customer[0]) return null;

    const { total_visits, total_spent, days_since_first_visit, days_since_last_visit } = customer[0];
    let segment = 'new';

    // AI Segmentation Logic
    if (total_visits >= 10 && total_spent >= 5000000) {
      segment = 'vip';
    } else if (total_visits >= 4 || total_spent >= 1000000) {
      segment = 'regular';
    } else if (days_since_last_visit > 30) {
      segment = 'churned';
    } else if (total_visits >= 2) {
      segment = 'returning';
    }

    // Update customer segment
    await pool.execute(
      'UPDATE customers SET segment = ?, updated_at = NOW() WHERE id = ?',
      [segment, customerId]
    );

    return segment;
  }

  static async getCustomerInsights(restaurantId) {
    const [insights] = await pool.execute(
      `SELECT 
        segment,
        COUNT(*) as customer_count,
        AVG(total_visits) as avg_visits,
        AVG(total_spent) as avg_spent,
        SUM(total_spent) as total_revenue,
        MAX(total_spent) as max_spent
       FROM customers 
       WHERE restaurant_id = ?
       GROUP BY segment`,
      [restaurantId]
    );
    return insights;
  }

  static async getVIPCustomers(restaurantId, limit = 20) {
    const [vips] = await pool.execute(
      `SELECT * FROM customers 
       WHERE restaurant_id = ? AND segment = 'vip'
       ORDER BY total_spent DESC
       LIMIT ?`,
      [restaurantId, limit]
    );
    return vips;
  }

  static async triggerWinBackCampaign(customerId) {
    // Get churned customer
    const [customer] = await pool.execute(
      `SELECT * FROM customers 
       WHERE id = ? AND segment = 'churned'`,
      [customerId]
    );

    if (!customer[0]) return false;

    // Create win-back offer
    const [offer] = await pool.execute(
      `INSERT INTO campaigns 
      (customer_id, type, discount_percent, message, expires_at) 
      VALUES (?, 'winback', 15, 'Chúng tôi nhớ bạn! Nhận ưu đãi 15% cho lần quay lại', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [customerId]
    );

    // Send notification (Zalo/SMS/Email)
    // Implementation depends on integration

    return true;
  }
}

module.exports = Customer;