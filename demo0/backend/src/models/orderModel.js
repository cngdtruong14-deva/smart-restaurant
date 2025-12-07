const pool = require('../config/database');

const Order = {
  createOrder: async (orderData) => {
    const { table_id, customer_id, total_amount, status, items } = orderData;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert into orders table
      const [orderResult] = await connection.query(
        'INSERT INTO orders (table_id, customer_id, total_amount, status) VALUES (?, ?, ?, ?)',
        [table_id, customer_id, total_amount, status || 'pending']
      );
      const orderId = orderResult.insertId;

      // Insert order items
      for (const item of items) {
        await connection.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [orderId, item.product_id, item.quantity, item.price]
        );
      }

      await connection.commit();
      return orderId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  getOrderById: async (id) => {
    const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (orderRows.length === 0) return null;

    const [itemRows] = await pool.query(
      `SELECT oi.*, p.name, p.image_url 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [id]
    );

    return {
      ...orderRows[0],
      items: itemRows
    };
  },

  updateOrderStatus: async (id, status) => {
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  },

  getOrdersByTable: async (table_id) => {
    const [rows] = await pool.query('SELECT * FROM orders WHERE table_id = ? ORDER BY created_at DESC', [table_id]);
    return rows;
  },

  getAllOrders: async () => {
    const [rows] = await pool.query(`
      SELECT o.*, t.table_number 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id 
      ORDER BY o.created_at DESC
    `);
    return rows;
  }
};

module.exports = Order;