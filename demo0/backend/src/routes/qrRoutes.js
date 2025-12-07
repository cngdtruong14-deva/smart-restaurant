const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');

// Tạo QR code cho bàn
router.post('/table/:tableId', qrController.generateTableQR);

// Tạo QR code cho đơn hàng
router.post('/order/:orderId', qrController.generateOrderQR);

// Tạo QR thanh toán
router.post('/payment/:orderId', qrController.generatePaymentQR);

// Tạo QR đơn giản
router.post('/simple', qrController.generateSimpleQR);

// Xóa tất cả file QR
router.delete('/clear', qrController.clearAllQR);

module.exports = router;