const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const AuthMiddleware = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Rate limiting for auth endpoints
const authLimiter = AuthMiddleware.rateLimiter(5, 15 * 60 * 1000); // 5 requests per 15 minutes

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Staff/Admin Routes
router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
  ],
  validateRequest,
  AuthController.login
);

router.post('/verify-2fa',
  authLimiter,
  [
    body('tempToken').notEmpty(),
    body('code').isLength({ min: 6, max: 6 })
  ],
  validateRequest,
  AuthController.verify2FA
);

router.post('/logout',
  AuthMiddleware.verifyToken(),
  AuthController.logout
);

router.post('/refresh-token',
  AuthController.refreshToken
);

router.post('/forgot-password',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail()
  ],
  validateRequest,
  AuthController.forgotPassword
);

router.post('/reset-password',
  authLimiter,
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 })
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/)
  ],
  validateRequest,
  AuthController.resetPassword
);

router.post('/change-password',
  AuthMiddleware.verifyToken(),
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 })
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/)
  ],
  validateRequest,
  AuthController.changePassword
);

// Customer Routes
router.post('/customer/auth',
  authLimiter,
  [
    body('phone').optional().isMobilePhone('vi-VN'),
    body('email').optional().isEmail().normalizeEmail(),
    body('name').optional().isLength({ min: 2 }),
    body('otp').optional().isLength({ min: 6, max: 6 })
  ],
  validateRequest,
  AuthController.customerAuth
);

router.post('/customer/verify',
  authLimiter,
  [
    body('phone').isMobilePhone('vi-VN'),
    body('otp').isLength({ min: 6, max: 6 })
  ],
  validateRequest,
  async (req, res) => {
    // OTP verification logic for customers
  }
);

// Profile Routes
router.get('/profile',
  AuthMiddleware.verifyToken(),
  AuthController.getProfile
);

router.put('/profile',
  AuthMiddleware.verifyToken(),
  [
    body('name').optional().isLength({ min: 2 }),
    body('phone').optional().isMobilePhone('vi-VN'),
    body('email').optional().isEmail().normalizeEmail()
  ],
  validateRequest,
  async (req, res) => {
    // Update profile logic
  }
);

// Admin User Management Routes
router.get('/users',
  AuthMiddleware.verifyToken(['admin']),
  async (req, res) => {
    // Get all users
  }
);

router.post('/users',
  AuthMiddleware.verifyToken(['admin']),
  [
    body('name').isLength({ min: 2 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['admin', 'manager', 'staff', 'cashier', 'kitchen']),
    body('restaurant_id').optional().isInt(),
    body('branch_id').optional().isInt()
  ],
  validateRequest,
  async (req, res) => {
    // Create new user
  }
);

router.put('/users/:id',
  AuthMiddleware.verifyToken(['admin']),
  async (req, res) => {
    // Update user
  }
);

router.delete('/users/:id',
  AuthMiddleware.verifyToken(['admin']),
  async (req, res) => {
    // Delete/Deactivate user
  }
);

// Role Management Routes
router.get('/roles',
  AuthMiddleware.verifyToken(['admin']),
  async (req, res) => {
    // Get all roles
  }
);

router.post('/roles',
  AuthMiddleware.verifyToken(['admin']),
  [
    body('name').isLength({ min: 2 }),
    body('permissions').isArray()
  ],
  validateRequest,
  async (req, res) => {
    // Create new role
  }
);

// Permission Management
router.get('/permissions',
  AuthMiddleware.verifyToken(['admin']),
  async (req, res) => {
    // Get all permissions
    const permissions = [
      'view_dashboard',
      'manage_orders',
      'manage_menu',
      'manage_tables',
      'manage_customers',
      'manage_staff',
      'manage_inventory',
      'view_reports',
      'manage_settings',
      'manage_promotions',
      'manage_reservations',
      'view_analytics',
      'export_data'
    ];
    
    res.json({
      success: true,
      permissions
    });
  }
);

// Session Management
router.get('/sessions',
  AuthMiddleware.verifyToken(),
  async (req, res) => {
    // Get active sessions for current user
  }
);

router.delete('/sessions/:sessionId',
  AuthMiddleware.verifyToken(),
  async (req, res) => {
    // Terminate specific session
  }
);

// Health check for auth service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'auth-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;