const jwt = require('jsonwebtoken');
const { pool, redisClient } = require('../config/database');
const { promisify } = require('util');

class AuthMiddleware {
  // Verify JWT token
  static verifyToken = (roles = []) => {
    return async (req, res, next) => {
      try {
        // Get token from header
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
          token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies?.token) {
          token = req.cookies.token;
        }

        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'Không tìm thấy token. Vui lòng đăng nhập.'
          });
        }

        // Check if token is blacklisted
        const isBlacklisted = await redisClient.get(`blacklist:${token}`);
        if (isBlacklisted) {
          return res.status(401).json({
            success: false,
            error: 'Token đã bị vô hiệu hóa. Vui lòng đăng nhập lại.'
          });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const [users] = await pool.execute(
          `SELECT u.*, r.name as role_name, r.permissions
           FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE u.id = ? AND u.status = 'active'`,
          [decoded.id]
        );

        if (users.length === 0) {
          return res.status(401).json({
            success: false,
            error: 'Người dùng không tồn tại hoặc đã bị vô hiệu hóa.'
          });
        }

        const user = users[0];

        // Check role permissions
        if (roles.length > 0) {
          const userRole = user.role_name;
          const userPermissions = JSON.parse(user.permissions || '[]');
          
          let hasPermission = false;
          
          // Check if user has required role
          if (roles.includes(userRole)) {
            hasPermission = true;
          }
          
          // Check specific permissions
          if (roles.some(role => role.startsWith('permission:'))) {
            const requiredPermissions = roles
              .filter(role => role.startsWith('permission:'))
              .map(role => role.replace('permission:', ''));
            
            const hasAllPermissions = requiredPermissions.every(permission => 
              userPermissions.includes(permission)
            );
            
            hasPermission = hasAllPermissions;
          }

          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              error: 'Bạn không có quyền truy cập tính năng này.'
            });
          }
        }

        // Attach user to request
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role_name,
          restaurant_id: user.restaurant_id,
          branch_id: user.branch_id,
          permissions: JSON.parse(user.permissions || '[]')
        };

        // Refresh token if it's about to expire (less than 15 minutes)
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp - now < 900) { // 15 minutes in seconds
          const newToken = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
          );
          
          res.setHeader('X-Refreshed-Token', newToken);
          res.cookie('token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });
        }

        next();
      } catch (error) {
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            error: 'Token không hợp lệ.'
          });
        }
        
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: 'Token đã hết hạn. Vui lòng đăng nhập lại.'
          });
        }

        console.error('Auth middleware error:', error);
        res.status(500).json({
          success: false,
          error: 'Lỗi xác thực.'
        });
      }
    };
  };

  // Verify customer token (for mobile app)
  static verifyCustomerToken = async (req, res, next) => {
    try {
      let token;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
        // Allow anonymous access for some endpoints
        if (req.method === 'GET' && req.path.includes('/menu')) {
          return next();
        }
        return res.status(401).json({
          success: false,
          error: 'Vui lòng đăng nhập để tiếp tục.'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const [customers] = await pool.execute(
        `SELECT * FROM customers WHERE id = ? AND status = 'active'`,
        [decoded.id]
      );

      if (customers.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Tài khoản không tồn tại.'
        });
      }

      req.customer = customers[0];
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Token không hợp lệ.'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Phiên đăng nhập đã hết hạn.'
        });
      }

      console.error('Customer auth error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi xác thực.'
      });
    }
  };

  // Rate limiting middleware
  static rateLimiter = (limit, windowMs) => {
    return async (req, res, next) => {
      const key = `rate_limit:${req.ip}:${req.path}`;
      
      try {
        const current = await redisClient.incr(key);
        
        if (current === 1) {
          await redisClient.expire(key, windowMs / 1000);
        }
        
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
        res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + (windowMs / 1000));
        
        if (current > limit) {
          return res.status(429).json({
            success: false,
            error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.'
          });
        }
        
        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        next(); // Allow request if Redis fails
      }
    };
  };

  // CORS middleware
  static corsMiddleware = (req, res, next) => {
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? JSON.parse(process.env.ALLOWED_ORIGINS || '["https://yourdomain.com"]')
      : ['http://localhost:3000', 'http://localhost:3001'];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  };

  // Logging middleware
  static requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id || 'anonymous',
        restaurantId: req.user?.restaurant_id || 'N/A'
      };

      // Store in Redis for analytics
      redisClient.lPush('request_logs', JSON.stringify(logEntry));
      redisClient.lTrim('request_logs', 0, 999); // Keep only last 1000 logs

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`${logEntry.method} ${logEntry.url} ${logEntry.status} ${logEntry.duration}`);
      }
    });

    next();
  };
}

module.exports = AuthMiddleware;