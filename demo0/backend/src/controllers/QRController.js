const QRGenerator = require('../utils/generateQR');
const pool = require('../config/database');

const qrController = {
  generateTableQR: async (req, res) => {
    try {
      const { tableId } = req.params;
      const { baseUrl } = req.body;
      
      const [rows] = await pool.query('SELECT * FROM tables WHERE id = ?', [tableId]);
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bàn'
        });
      }
      
      const table = rows[0];
      const result = await QRGenerator.generateForTable(table, baseUrl || req.headers.origin);
      
      if (result.success) {
        await pool.query(
          'UPDATE tables SET qr_code = ?, updated_at = NOW() WHERE id = ?',
          [result.data.qr_image_url, tableId]
        );
        
        res.json({
          success: true,
          message: 'Đã tạo QR code thành công',
          data: {
            qr_url: result.data.qr_image_url,
            qr_data_url: result.data.qr_data_url,
            table_id: tableId,
            table_number: table.table_number
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Lỗi tạo QR code',
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  },
  
  generateOrderQR: async (req, res) => {
    try {
      const { orderId } = req.params;
      
      const [rows] = await pool.query(`
        SELECT o.*, t.table_number 
        FROM orders o 
        LEFT JOIN tables t ON o.table_id = t.id 
        WHERE o.id = ?
      `, [orderId]);
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đơn hàng'
        });
      }
      
      const order = rows[0];
      const result = await QRGenerator.generateForOrder(order, req.headers.origin);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Lỗi tạo QR đơn hàng',
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  },
  
  generatePaymentQR: async (req, res) => {
    try {
      const { orderId } = req.params;
      const { bank_code } = req.body;
      
      const [rows] = await pool.query(`
        SELECT o.*, c.name as customer_name 
        FROM orders o 
        LEFT JOIN customers c ON o.customer_id = c.id 
        WHERE o.id = ?
      `, [orderId]);
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đơn hàng'
        });
      }
      
      const order = rows[0];
      const paymentData = {
        amount: order.total_amount,
        order_id: order.id,
        customer_name: order.customer_name || 'Khách hàng',
        bank_code: bank_code || 'VNPAY'
      };
      
      const result = await QRGenerator.generateForPayment(paymentData);
      
      if (result.success) {
        await pool.query(
          `INSERT INTO payment_qr (order_id, qr_content, bank_code, amount) 
           VALUES (?, ?, ?, ?)`,
          [order.id, result.data.qr_content, paymentData.bank_code, paymentData.amount]
        );
        
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Lỗi tạo QR thanh toán',
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  },
  
  generateSimpleQR: async (req, res) => {
    try {
      const { url, width = 200 } = req.body;
      
      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'URL là bắt buộc'
        });
      }
      
      const qrDataUrl = await QRGenerator.generateSimpleQR(url, { width });
      
      res.json({
        success: true,
        data: {
          qr_data_url: qrDataUrl,
          url: url
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi tạo QR',
        error: error.message
      });
    }
  },
  
  clearAllQR: async (req, res) => {
    try {
      const result = QRGenerator.clearAllQRFiles();
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          deleted_count: result.deleted_count
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Lỗi xóa file QR',
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }
};

module.exports = qrController;