const { pool } = require('../config/database');

class Role {
  // Get all roles
  static async findAll(filters = {}) {
    let query = `SELECT * FROM roles WHERE 1=1`;
    const params = [];

    if (filters.name) {
      query += ` AND name LIKE ?`;
      params.push(`%${filters.name}%`);
    }

    if (filters.is_system !== undefined) {
      query += ` AND is_system = ?`;
      params.push(filters.is_system);
    }

    query += ` ORDER BY created_at DESC`;

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Find role by ID
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM roles WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  // Find role by name
  static async findByName(name) {
    const [rows] = await pool.execute(
      'SELECT * FROM roles WHERE name = ?',
      [name]
    );
    return rows[0];
  }

  // Create new role
  static async create(roleData) {
    const { name, description, permissions, is_system = false } = roleData;

    const [result] = await pool.execute(
      `INSERT INTO roles (name, description, permissions, is_system) 
       VALUES (?, ?, ?, ?)`,
      [name, description, JSON.stringify(permissions), is_system]
    );

    return result.insertId;
  }

  // Update role
  static async update(id, updateData) {
    const allowedFields = ['name', 'description', 'permissions'];
    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(key === 'permissions' ? JSON.stringify(updateData[key]) : updateData[key]);
      }
    });

    if (updates.length === 0) {
      return 0;
    }

    values.push(id);

    const query = `UPDATE roles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND is_system = false`;
    const [result] = await pool.execute(query, values);

    return result.affectedRows;
  }

  // Delete role
  static async delete(id) {
    // Check if role is in use
    const [users] = await pool.execute(
      'SELECT COUNT(*) as user_count FROM users WHERE role_id = ?',
      [id]
    );

    if (users[0].user_count > 0) {
      throw new Error('Không thể xóa vai trò đang được sử dụng');
    }

    const [result] = await pool.execute(
      'DELETE FROM roles WHERE id = ? AND is_system = false',
      [id]
    );

    return result.affectedRows;
  }

  // Get system roles (cannot be deleted)
  static async getSystemRoles() {
    const [rows] = await pool.execute(
      'SELECT * FROM roles WHERE is_system = true ORDER BY name'
    );
    return rows;
  }

  // Get role permissions
  static async getPermissions(roleId) {
    const [rows] = await pool.execute(
      'SELECT permissions FROM roles WHERE id = ?',
      [roleId]
    );

    if (rows.length === 0) {
      return [];
    }

    return JSON.parse(rows[0].permissions || '[]');
  }

  // Check if role has permission
  static async hasPermission(roleId, permission) {
    const permissions = await this.getPermissions(roleId);
    return permissions.includes(permission);
  }

  // Add permission to role
  static async addPermission(roleId, permission) {
    const permissions = await this.getPermissions(roleId);
    
    if (!permissions.includes(permission)) {
      permissions.push(permission);
      
      const [result] = await pool.execute(
        'UPDATE roles SET permissions = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(permissions), roleId]
      );

      return result.affectedRows;
    }

    return 0;
  }

  // Remove permission from role
  static async removePermission(roleId, permission) {
    const permissions = await this.getPermissions(roleId);
    const updatedPermissions = permissions.filter(p => p !== permission);

    const [result] = await pool.execute(
      'UPDATE roles SET permissions = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(updatedPermissions), roleId]
    );

    return result.affectedRows;
  }

  // Get role statistics
  static async getStatistics() {
    const [rows] = await pool.execute(`
      SELECT 
        r.name,
        r.description,
        COUNT(u.id) as user_count,
        JSON_LENGTH(r.permissions) as permission_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id
      ORDER BY user_count DESC
    `);
    return rows;
  }
}

module.exports = Role;