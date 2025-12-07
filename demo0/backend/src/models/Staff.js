const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class Staff {
  static async findByEmail(email) {
    const [rows] = await pool.execute(
      'SELECT * FROM staff WHERE email = ?',
      [email]
    );
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, role, restaurant_id, created_at FROM staff WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async create(staffData) {
    const { name, email, phone, password, role, restaurant_id } = staffData;
    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO staff (name, email, phone, password_hash, role, restaurant_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, phone, password_hash, role, restaurant_id]
    );

    return result.insertId;
  }

  static async updateLastLogin(id) {
    await pool.execute(
      'UPDATE staff SET last_login = NOW() WHERE id = ?',
      [id]
    );
  }

  static async comparePassword(candidatePassword, hashedPassword) {
    return bcrypt.compare(candidatePassword, hashedPassword);
  }
}

module.exports = Staff;