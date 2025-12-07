// 1. Tạo QR cho bàn
const QRGenerator = require('./utils/generateQR');

// Tạo QR cho bàn số 1
const result = await QRGenerator.generateForTable(
  { id: 1, table_number: 'T01' },
  'http://your-restaurant.com'
);

if (result.success) {
  console.log('QR URL:', result.data.qr_image_url);
  console.log('QR Data URL (base64):', result.data.qr_data_url);
}

// 2. Tạo QR đơn giản
const qrDataUrl = await QRGenerator.generateSimpleQR(
  'http://your-restaurant.com/menu?table=1',
  { width: 250 }
);

// 3. Tạo QR thanh toán
const paymentQR = await QRGenerator.generateForPayment({
  amount: 150000,
  order_id: 123,
  customer_name: 'Nguyễn Văn A',
  bank_code: 'VNPAY'
});