const pool = require('../config/database');

const productModel = {
  // Get all products with category
  getAll: async () => {
    const [rows] = await pool.execute(`
      SELECT p.*, c.name as category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'active'
      ORDER BY c.sort_order, p.sort_order
    `);
    return rows;
  },

  // Get by ID
  getById: async (id) => {
    const [rows] = await pool.execute(
      'SELECT * FROM products WHERE id = ? AND status = "active"',
      [id]
    );
    return rows[0];
  },

  // Create new product
  create: async (productData) => {
    const { name, description, price, category_id, image_url } = productData;
    const [result] = await pool.execute(
      `INSERT INTO products (name, description, price, category_id, image_url, status) 
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [name, description, price, category_id, image_url]
    );
    return result.insertId;
  },

  // Update product
  update: async (id, productData) => {
    const { name, description, price, category_id, image_url } = productData;
    const [result] = await pool.execute(
      `UPDATE products 
       SET name = ?, description = ?, price = ?, category_id = ?, image_url = ?
       WHERE id = ?`,
      [name, description, price, category_id, image_url, id]
    );
    return result.affectedRows > 0;
  },

  // Soft delete
  delete: async (id) => {
    const [result] = await pool.execute(
      'UPDATE products SET status = "inactive" WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  },

  // Get best sellers
  getBestSellers: async (limit = 5) => {
    const [rows] = await pool.execute(`
      SELECT p.*, COUNT(oi.id) as sold_count
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND p.status = 'active'
      GROUP BY p.id
      ORDER BY sold_count DESC
      LIMIT ?
    `, [limit]);
    return rows;
  },

  // Search products
  search: async (keyword) => {
    const [rows] = await pool.execute(
      `SELECT * FROM products 
       WHERE (name LIKE ? OR description LIKE ?) 
       AND status = 'active'
       LIMIT 20`,
      [`%${keyword}%`, `%${keyword}%`]
    );
    return rows;
  }
};

module.exports = productModel;