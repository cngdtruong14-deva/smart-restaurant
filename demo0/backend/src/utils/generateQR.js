const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class QRGenerator {
  constructor() {
    this.qrDir = path.join(__dirname, '../public/qr-codes');
    
    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(this.qrDir)) {
      fs.mkdirSync(this.qrDir, { recursive: true });
    }
  }

  /**
   * Tạo mã QR cho bàn ăn
   * @param {Object} tableData - Thông tin bàn
   * @param {number} tableData.id - ID bàn
   * @param {string} tableData.table_number - Số bàn
   * @param {string} baseUrl - URL gốc của ứng dụng
   * @param {Object} options - Tùy chọn tạo QR
   * @returns {Promise<Object>} - QR code data
   */
  async generateForTable(tableData, baseUrl = 'http://localhost:3000', options = {}) {
    try {
      const { id, table_number } = tableData;
      
      // Dữ liệu sẽ được mã hóa trong QR
      const qrData = {
        table_id: id,
        table_number: table_number,
        url: `${baseUrl}/menu?table=${id}`,
        timestamp: new Date().toISOString(),
        restaurant_id: options.restaurant_id || 1
      };

      const qrString = JSON.stringify(qrData);
      
      // Tạo mã QR dưới dạng Data URL (base64)
      const qrOptions = {
        errorCorrectionLevel: 'H', // High error correction
        type: 'png',
        quality: 0.9,
        margin: 2,
        width: options.width || 300,
        color: {
          dark: options.darkColor || '#000000',
          light: options.lightColor || '#FFFFFF'
        }
      };

      // Tạo QR code
      const qrDataUrl = await QRCode.toDataURL(qrString, qrOptions);
      
      // Lưu file QR code
      const fileName = `table_${table_number}_${id}_${Date.now()}.png`;
      const filePath = path.join(this.qrDir, fileName);
      
      // Chuyển data URL thành buffer và lưu file
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(filePath, base64Data, 'base64');
      
      // Tạo đường dẫn URL để truy cập file
      const qrUrl = `/qr-codes/${fileName}`;
      
      return {
        success: true,
        data: {
          qr_data: qrString,
          qr_image_url: qrUrl,
          qr_data_url: qrDataUrl,
          file_path: filePath,
          table_id: id,
          table_number: table_number
        }
      };
    } catch (error) {
      console.error('Error generating QR code:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Tạo mã QR đơn giản (chỉ chứa URL)
   * @param {string} url - URL cần mã hóa
   * @param {Object} options - Tùy chọn
   * @returns {Promise<string>} - Data URL của QR
   */
  async generateSimpleQR(url, options = {}) {
    try {
      const qrOptions = {
        errorCorrectionLevel: 'M',
        type: 'png',
        margin: 1,
        width: options.width || 200,
        color: {
          dark: options.darkColor || '#000000',
          light: options.lightColor || '#FFFFFF'
        }
      };

      const qrDataUrl = await QRCode.toDataURL(url, qrOptions);
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating simple QR:', error);
      throw error;
    }
  }

  /**
   * Tạo mã QR cho nhiều bàn cùng lúc
   * @param {Array} tables - Danh sách bàn
   * @param {string} baseUrl - URL gốc
   * @param {Object} options - Tùy chọn
   * @returns {Promise<Array>} - Danh sách QR đã tạo
   */
  async generateBatch(tables, baseUrl = 'http://localhost:3000', options = {}) {
    try {
      const results = [];
      
      for (const table of tables) {
        const result = await this.generateForTable(table, baseUrl, options);
        results.push(result);
      }
      
      return {
        success: true,
        data: results,
        total: tables.length,
        generated: results.filter(r => r.success).length
      };
    } catch (error) {
      console.error('Error generating batch QR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Xóa file QR code cũ
   * @param {string} filePath - Đường dẫn file
   * @returns {boolean} - Kết quả xóa
   */
  deleteQRFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting QR file:', error);
      return false;
    }
  }

  /**
   * Xóa tất cả file QR code trong thư mục
   * @returns {Object} - Kết quả xóa
   */
  clearAllQRFiles() {
    try {
      const files = fs.readdirSync(this.qrDir);
      let deletedCount = 0;
      
      files.forEach(file => {
        const filePath = path.join(this.qrDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      
      return {
        success: true,
        message: `Đã xóa ${deletedCount} file QR code`,
        deleted_count: deletedCount
      };
    } catch (error) {
      console.error('Error clearing QR files:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Tạo mã QR với logo của nhà hàng
   * @param {Object} tableData - Thông tin bàn
   * @param {string} logoPath - Đường dẫn logo
   * @param {string} baseUrl - URL gốc
   * @returns {Promise<Object>} - QR code với logo
   */
  async generateQRWithLogo(tableData, logoPath, baseUrl = 'http://localhost:3000') {
    try {
      const QRCodeWithLogo = require('qrcode-with-logo');
      
      const { id, table_number } = tableData;
      const qrData = `${baseUrl}/menu?table=${id}`;
      
      // Cấu hình QR với logo
      const qr = new QRCodeWithLogo({
        content: qrData,
        width: 300,
        logo: {
          src: logoPath,
          logoRadius: 10
        },
        nodeQrCodeOptions: {
          errorCorrectionLevel: 'H'
        }
      });
      
      // Tạo file QR
      const fileName = `table_${table_number}_${id}_with_logo_${Date.now()}.png`;
      const filePath = path.join(this.qrDir, fileName);
      
      await qr.toImageFile(filePath);
      
      return {
        success: true,
        data: {
          qr_url: `/qr-codes/${fileName}`,
          file_path: filePath,
          table_id: id,
          table_number: table_number
        }
      };
    } catch (error) {
      console.error('Error generating QR with logo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Tạo QR code cho đơn hàng (Order QR)
   * @param {Object} orderData - Thông tin đơn hàng
   * @param {string} baseUrl - URL gốc
   * @returns {Promise<Object>} - QR code đơn hàng
   */
  async generateForOrder(orderData, baseUrl = 'http://localhost:3000') {
    try {
      const { id, table_id, customer_id, total_amount } = orderData;
      
      const qrData = {
        order_id: id,
        table_id: table_id,
        customer_id: customer_id,
        total_amount: total_amount,
        url: `${baseUrl}/order/${id}`,
        timestamp: new Date().toISOString(),
        type: 'order'
      };
      
      const qrString = JSON.stringify(qrData);
      const qrDataUrl = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: 'H',
        width: 250,
        margin: 1
      });
      
      return {
        success: true,
        data: {
          qr_data: qrString,
          qr_data_url: qrDataUrl,
          order_id: id,
          table_id: table_id
        }
      };
    } catch (error) {
      console.error('Error generating order QR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Tạo QR code thanh toán
   * @param {Object} paymentData - Thông tin thanh toán
   * @returns {Promise<Object>} - QR code thanh toán
   */
  async generateForPayment(paymentData) {
    try {
      const { amount, order_id, customer_name, bank_code = 'VNPAY' } = paymentData;
      
      // Tạo nội dung QR theo chuẩn ngân hàng
      let qrContent = '';
      
      if (bank_code === 'VNPAY') {
        qrContent = this.generateVNPAYQR(amount, order_id);
      } else if (bank_code === 'MOMO') {
        qrContent = this.generateMomoQR(amount, order_id, customer_name);
      } else {
        // QR code chung
        qrContent = JSON.stringify({
          amount: amount,
          order_id: order_id,
          customer_name: customer_name,
          bank: bank_code,
          timestamp: new Date().toISOString()
        });
      }
      
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        errorCorrectionLevel: 'Q',
        width: 300,
        margin: 2
      });
      
      return {
        success: true,
        data: {
          qr_content: qrContent,
          qr_data_url: qrDataUrl,
          order_id: order_id,
          amount: amount,
          bank_code: bank_code
        }
      };
    } catch (error) {
      console.error('Error generating payment QR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Tạo QR code theo chuẩn VNPAY
   * @private
   */
  generateVNPAYQR(amount, order_id) {
    // Format theo chuẩn VNPAY QR
    return `00020101021229370016A000000727013001069704220114${amount}5204000053037045802VN5914RESTAURANT NAME6005HO CHI61057000062180113ORDER_${order_id}6304`;
  }

  /**
   * Tạo QR code theo chuẩn Momo
   * @private
   */
  generateMomoQR(amount, order_id, customer_name) {
    // Format theo chuẩn Momo QR
    return `2|99|0123456789|${customer_name}|${order_id}|${amount}|0|0|0`;
  }

  /**
   * Kiểm tra và sửa chữa file QR bị hỏng
   * @param {string} filePath - Đường dẫn file QR
   * @returns {Promise<Object>} - Kết quả kiểm tra
   */
  async validateQRFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          valid: false,
          error: 'File không tồn tại'
        };
      }
      
      // Đọc file và kiểm tra định dạng
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      // Kiểm tra kích thước file
      if (fileSize < 100) {
        return {
          valid: false,
          error: 'File QR quá nhỏ, có thể bị hỏng'
        };
      }
      
      // Kiểm tra header PNG
      const buffer = fs.readFileSync(filePath);
      const isPNG = buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
      
      if (!isPNG) {
        return {
          valid: false,
          error: 'File không phải định dạng PNG hợp lệ'
        };
      }
      
      return {
        valid: true,
        file_size: fileSize,
        format: 'PNG'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = new QRGenerator();