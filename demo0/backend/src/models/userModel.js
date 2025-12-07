const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Create new user
  static async create(userData) {
    const {
      name,
      email,
      phone,
      password,
      role_id,
      restaurant_id,
      branch_id,
      status = 'active'
    } = userData;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const [result] = await pool.execute(
      `INSERT INTO users 
      (name, email, phone, password_hash, role_id, restaurant_id, branch_id, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone, password_hash, role_id, restaurant_id, branch_id, status]
    );

    return result.insertId;
  }

  // Find user by email
  static async findByEmail(email) {
    const [rows] = await pool.execute(
      `SELECT u.*, r.name as role_name, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email]
    );
    return rows[0];
  }

  // Find user by ID
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT u.*, r.name as role_name, r.permissions,
              re.name as restaurant_name, b.name as branch_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN restaurants re ON u.restaurant_id = re.id
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = ?`,
      [id]
    );
    return rows[0];
  }

  // Find all users with filters
  static async findAll(filters = {}) {
    let query = `
      SELECT u.*, r.name as role_name, 
             re.name as restaurant_name, b.name as branch_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN restaurants re ON u.restaurant_id = re.id
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE 1=1
    `;
    
    const params = [];

    if (filters.restaurant_id) {
      query += ` AND u.restaurant_id = ?`;
      params.push(filters.restaurant_id);
    }

    if (filters.branch_id) {
      query += ` AND u.branch_id = ?`;
      params.push(filters.branch_id);
    }

    if (filters.role) {
      query += ` AND r.name = ?`;
      params.push(filters.role);
    }

    if (filters.status) {
      query += ` AND u.status = ?`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY u.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(filters.offset);
    }

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Update user
  static async update(id, updateData) {
    const allowedFields = [
      'name', 'phone', 'role_id', 'restaurant_id', 
      'branch_id', 'status', 'profile_image'
    ];

    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (updates.length === 0) {
      return 0;
    }

    values.push(id);

    const query = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
    const [result] = await pool.execute(query, values);

    return result.affectedRows;
  }

  // Change password
  static async changePassword(id, newPassword) {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    const [result] = await pool.execute(
      `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
      [password_hash, id]
    );

    return result.affectedRows;
  }

  // Verify password
  static async verifyPassword(userId, password) {
    const [rows] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return false;
    }

    return await bcrypt.compare(password, rows[0].password_hash);
  }

  // Get user permissions
  static async getPermissions(userId) {
    const [rows] = await pool.execute(
      `SELECT r.permissions 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return [];
    }

    return JSON.parse(rows[0].permissions || '[]');
  }

  // Check if user has permission
  static async hasPermission(userId, permission) {
    const permissions = await this.getPermissions(userId);
    return permissions.includes(permission);
  }

  // Get user statistics
  static async getStatistics(restaurantId = null) {
    let query = `
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_users,
        SUM(CASE WHEN status = 'locked' THEN 1 ELSE 0 END) as locked_users,
        r.name as role_name,
        COUNT(*) as role_count
      FROM users u
      JOIN roles r ON u.role_id = r.id
    `;

    const params = [];

    if (restaurantId) {
      query += ` WHERE u.restaurant_id = ?`;
      params.push(restaurantId);
    }

    query += ` GROUP BY r.name`;

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Get recent activities
  static async getRecentActivities(userId, limit = 10) {
    const [rows] = await pool.execute(
      `SELECT * FROM audit_logs 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );
    return rows;
  }

  // Deactivate user
  static async deactivate(id) {
    const [result] = await pool.execute(
      `UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = ?`,
      [id]
    );
    return result.affectedRows;
  }

  // Reactivate user
  static async reactivate(id) {
    const [result] = await pool.execute(
      `UPDATE users SET status = 'active', updated_at = NOW() WHERE id = ?`,
      [id]
    );
    return result.affectedRows;
  }
}

module.exports = User;