const pool = require('../config/database');

const QRGenerator = require('../utils/generateQR');
const Table = {
  getAll: async () => {
    const [rows] = await pool.query('SELECT * FROM tables');
    return rows;
  },

  getById: async (id) => {
    const [rows] = await pool.query('SELECT * FROM tables WHERE id = ?', [id]);
    return rows[0];
  },

  create: async (tableData) => {
    const { table_number, capacity, qr_code, status } = tableData;
    const [result] = await pool.query(
      'INSERT INTO tables (table_number, capacity, qr_code, status) VALUES (?, ?, ?, ?)',
      [table_number, capacity, qr_code, status || 'available']
    );
    return result.insertId;
  },

  update: async (id, tableData) => {
    const { table_number, capacity, qr_code, status } = tableData;
    await pool.query(
      'UPDATE tables SET table_number = ?, capacity = ?, qr_code = ?, status = ? WHERE id = ?',
      [table_number, capacity, qr_code, status, id]
    );
  },
    generateQR: async (tableId, baseUrl = 'http://localhost:3000') => {
    try {
      // Lấy thông tin bàn
      const [rows] = await pool.query('SELECT * FROM tables WHERE id = ?', [tableId]);
      if (rows.length === 0) {
        throw new Error('Bàn không tồn tại');
      }
      
      const table = rows[0];
      
      // Tạo QR code
      const qrResult = await QRGenerator.generateForTable(table, baseUrl);
      
      if (qrResult.success) {
        // Cập nhật QR code vào database
        await pool.query(
          'UPDATE tables SET qr_code = ?, updated_at = NOW() WHERE id = ?',
          [qrResult.data.qr_image_url, tableId]
        );
        
        return {
          success: true,
          qr_url: qrResult.data.qr_image_url,
          qr_data_url: qrResult.data.qr_data_url,
          table: table
        };
      } else {
        throw new Error(qrResult.error);
      }
    } catch (error) {
      console.error('Error generating QR:', error);
      throw error;
    }
  },
  
  // Tạo QR code cho tất cả bàn
  generateAllQR: async (baseUrl = 'http://localhost:3000') => {
    try {
      // Lấy tất cả bàn
      const [tables] = await pool.query('SELECT * FROM tables');
      
      const results = [];
      
      for (const table of tables) {
        try {
          const qrResult = await QRGenerator.generateForTable(table, baseUrl);
          
          if (qrResult.success) {
            // Cập nhật QR code vào database
            await pool.query(
              'UPDATE tables SET qr_code = ?, updated_at = NOW() WHERE id = ?',
              [qrResult.data.qr_image_url, table.id]
            );
            
            results.push({
              table_id: table.id,
              table_number: table.table_number,
              success: true,
              qr_url: qrResult.data.qr_image_url
            });
          } else {
            results.push({
              table_id: table.id,
              table_number: table.table_number,
              success: false,
              error: qrResult.error
            });
          }
        } catch (error) {
          results.push({
            table_id: table.id,
            table_number: table.table_number,
            success: false,
            error: error.message
          });
        }
      }
      
      return {
        total: tables.length,
        success_count: results.filter(r => r.success).length,
        failed_count: results.filter(r => !r.success).length,
        results: results
      };
    } catch (error) {
      console.error('Error generating all QR:', error);
      throw error;
    }
  },
  delete: async (id) => {
    await pool.query('DELETE FROM tables WHERE id = ?', [id]);
  }
};

module.exports = Table;