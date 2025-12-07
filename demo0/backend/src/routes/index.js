const express = require('express');
const router = express.Router();

// Import all routes
const authRoutes = require('./auth');
const productRoutes = require('./productRoutes');
const orderRoutes = require('./orderRoutes');
const tableRoutes = require('./tableRoutes');
const qrRoutes = require('./qrRoutes');
const userRoutes = require('./userRoutes');

// Use routes
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/tables', tableRoutes);
router.use('/qr', qrRoutes);
router.use('/users', userRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Smart Restaurant API'
  });
});

// 404 handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

module.exports = router;