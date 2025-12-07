const pool = require('../config/database');

const orderController = {
  // Create new order
  createOrder: async (req, res) => {
    try {
      const { table_id, items, total_amount, customer_id } = req.body;
      
      // Start transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // 1. Create order
        const [orderResult] = await connection.execute(
          'INSERT INTO orders (table_id, customer_id, total_amount, status) VALUES (?, ?, ?, ?)',
          [table_id, customer_id, total_amount, 'pending']
        );
        
        const orderId = orderResult.insertId;
        
        // 2. Insert order items
        for (const item of items) {
          await connection.execute(
            'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
            [orderId, item.product_id, item.quantity, item.price]
          );
        }
        
        // 3. Update table status
        await connection.execute(
          'UPDATE tables SET status = ? WHERE id = ?',
          ['occupied', table_id]
        );
        
        await connection.commit();
        
        res.status(201).json({
          success: true,
          message: 'Order created successfully',
          orderId,
          data: {
            order_id: orderId,
            table_id,
            items,
            total_amount,
            status: 'pending'
          }
        });
        
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create order'
      });
    }
  },

  // Get orders for kitchen
  getKitchenOrders: async (req, res) => {
    try {
      const [orders] = await pool.execute(`
        SELECT o.*, t.table_number 
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        WHERE o.status IN ('pending', 'preparing')
        ORDER BY o.created_at ASC
      `);
      
      res.json({
        success: true,
        data: orders
      });
      
    } catch (error) {
      console.error('Get kitchen orders error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch orders'
      });
    }
  },

  // Update order status
  updateOrderStatus: async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      
      await pool.execute(
        'UPDATE orders SET status = ? WHERE id = ?',
        [status, orderId]
      );
      
      // Get table_id for socket emission
      const [order] = await pool.execute(
        'SELECT table_id FROM orders WHERE id = ?',
        [orderId]
      );
      
      res.json({
        success: true,
        message: 'Order status updated',
        data: {
          orderId,
          status,
          tableId: order[0]?.table_id
        }
      });
      
    } catch (error) {
      console.error('Update order status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update order status'
      });
    }
  },

  // Get order history
  getOrderHistory: async (req, res) => {
    try {
      const { tableId, limit = 10 } = req.query;
      
      let query = `
        SELECT o.*, t.table_number,
               JSON_ARRAYAGG(
                 JSON_OBJECT(
                   'product_id', p.id,
                   'name', p.name,
                   'quantity', oi.quantity,
                   'price', oi.price
                 )
               ) as items
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
      `;
      
      const params = [];
      if (tableId) {
        query += ' WHERE o.table_id = ?';
        params.push(tableId);
      }
      
      query += ' GROUP BY o.id ORDER BY o.created_at DESC LIMIT ?';
      params.push(parseInt(limit));
      
      const [orders] = await pool.execute(query, params);
      
      res.json({
        success: true,
        data: orders
      });
      
    } catch (error) {
      console.error('Get order history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order history'
      });
    }
  }
};

module.exports = orderController;