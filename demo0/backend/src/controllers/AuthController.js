const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool, redisClient } = require('../config/database');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');

class AuthController {
  // Staff/Admin Login
  static async login(req, res) {
    const { email, password, rememberMe } = req.body;

    try {
      // Find user
      const [users] = await pool.execute(
        `SELECT u.*, r.name as role_name, r.permissions, 
                re.name as restaurant_name, b.name as branch_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN restaurants re ON u.restaurant_id = re.id
         LEFT JOIN branches b ON u.branch_id = b.id
         WHERE u.email = ? AND u.status = 'active'`,
        [email]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Email hoặc mật khẩu không chính xác.'
        });
      }

      const user = users[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        // Log failed attempt
        await redisClient.incr(`failed_login:${email}`);
        await redisClient.expire(`failed_login:${email}`, 3600); // 1 hour

        const failedAttempts = await redisClient.get(`failed_login:${email}`) || 0;
        if (failedAttempts >= 5) {
          await pool.execute(
            'UPDATE users SET status = "locked" WHERE email = ?',
            [email]
          );
          
          return res.status(403).json({
            success: false,
            error: 'Tài khoản đã bị khóa do quá nhiều lần đăng nhập sai.'
          });
        }

        return res.status(401).json({
          success: false,
          error: 'Email hoặc mật khẩu không chính xác.',
          remainingAttempts: 5 - failedAttempts
        });
      }

      // Reset failed login counter
      await redisClient.del(`failed_login:${email}`);

      // Check if 2FA is required (for admin roles)
      if (user.role_name === 'admin' || user.role_name === 'manager') {
        const secret = speakeasy.generateSecret({ length: 20 });
        const tempToken = crypto.randomBytes(32).toString('hex');
        
        await redisClient.setEx(
          `2fa:${tempToken}`,
          300, // 5 minutes
          JSON.stringify({
            userId: user.id,
            secret: secret.base32
          })
        );

        return res.json({
          success: true,
          requires2FA: true,
          tempToken,
          message: 'Vui lòng xác thực 2 bước.'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role_name,
          restaurant_id: user.restaurant_id,
          branch_id: user.branch_id
        },
        process.env.JWT_SECRET,
        { expiresIn: rememberMe ? '30d' : process.env.JWT_EXPIRE }
      );

      // Update last login
      await pool.execute(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );

      // Log successful login
      await pool.execute(
        `INSERT INTO audit_logs 
        (user_id, action, ip_address, user_agent, details) 
        VALUES (?, 'login', ?, ?, ?)`,
        [
          user.id,
          req.ip,
          req.headers['user-agent'],
          JSON.stringify({ userAgent: req.headers['user-agent'] })
        ]
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role_name,
          restaurant_id: user.restaurant_id,
          branch_id: user.branch_id,
          restaurant_name: user.restaurant_name,
          branch_name: user.branch_name,
          permissions: JSON.parse(user.permissions || '[]')
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi đăng nhập. Vui lòng thử lại.'
      });
    }
  }

  // Customer Login/Register
  static async customerAuth(req, res) {
    const { phone, email, name, otp } = req.body;

    try {
      // Check if customer exists
      const [customers] = await pool.execute(
        `SELECT * FROM customers 
         WHERE (phone = ? OR email = ?) AND status = 'active'`,
        [phone, email]
      );

      let customer;
      
      if (customers.length === 0) {
        // Register new customer
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        const [result] = await pool.execute(
          `INSERT INTO customers 
          (name, phone, email, verification_code, segment) 
          VALUES (?, ?, ?, ?, 'new')`,
          [name, phone, email, verificationCode]
        );

        customer = {
          id: result.insertId,
          name,
          phone,
          email,
          segment: 'new'
        };

        // Send OTP via SMS or Email
        await this.sendVerificationCode(phone, email, verificationCode);

        res.json({
          success: true,
          requiresVerification: true,
          message: 'Mã xác thực đã được gửi.'
        });

      } else {
        customer = customers[0];
        
        if (otp) {
          // Verify OTP
          if (customer.verification_code !== otp) {
            return res.status(400).json({
              success: false,
              error: 'Mã xác thực không đúng.'
            });
          }

          // Clear verification code
          await pool.execute(
            'UPDATE customers SET verification_code = NULL WHERE id = ?',
            [customer.id]
          );

        } else {
          // Send new OTP
          const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
          
          await pool.execute(
            'UPDATE customers SET verification_code = ? WHERE id = ?',
            [verificationCode, customer.id]
          );

          await this.sendVerificationCode(phone, email, verificationCode);

          return res.json({
            success: true,
            requiresVerification: true,
            message: 'Mã xác thực đã được gửi.'
          });
        }

        // Generate customer token
        const token = jwt.sign(
          {
            id: customer.id,
            phone: customer.phone,
            type: 'customer'
          },
          process.env.JWT_SECRET,
          { expiresIn: '30d' }
        );

        // Update last login
        await pool.execute(
          'UPDATE customers SET last_login = NOW() WHERE id = ?',
          [customer.id]
        );

        // Auto-segment customer
        await pool.execute(
          `CALL update_customer_segments(?)`,
          [customer.restaurant_id]
        );

        res.json({
          success: true,
          token,
          customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            segment: customer.segment,
            loyalty_points: customer.loyalty_points,
            total_visits: customer.total_visits,
            total_spent: customer.total_spent
          }
        });
      }

    } catch (error) {
      console.error('Customer auth error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi xác thực. Vui lòng thử lại.'
      });
    }
  }

  // 2FA Verification
  static async verify2FA(req, res) {
    const { tempToken, code } = req.body;

    try {
      const data = await redisClient.get(`2fa:${tempToken}`);
      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Mã xác thực đã hết hạn.'
        });
      }

      const { userId, secret } = JSON.parse(data);
      
      // Verify TOTP code
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 1
      });

      if (!verified) {
        return res.status(400).json({
          success: false,
          error: 'Mã xác thực không đúng.'
        });
      }

      // Get user info
      const [users] = await pool.execute(
        `SELECT u.*, r.name as role_name, r.permissions
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = ?`,
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Người dùng không tồn tại.'
        });
      }

      const user = users[0];

      // Generate final JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role_name,
          restaurant_id: user.restaurant_id,
          branch_id: user.branch_id,
          twoFactorVerified: true
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      // Clean up temp token
      await redisClient.del(`2fa:${tempToken}`);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role_name,
          restaurant_id: user.restaurant_id,
          branch_id: user.branch_id,
          permissions: JSON.parse(user.permissions || '[]')
        }
      });

    } catch (error) {
      console.error('2FA verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi xác thực 2 bước.'
      });
    }
  }

  // Logout
  static async logout(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (token) {
        // Add token to blacklist with expiration
        const decoded = jwt.decode(token);
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        
        if (expiresIn > 0) {
          await redisClient.setEx(`blacklist:${token}`, expiresIn, 'blacklisted');
        }
      }

      // Clear cookie
      res.clearCookie('token');

      // Log logout action
      if (req.user) {
        await pool.execute(
          `INSERT INTO audit_logs 
          (user_id, action, ip_address, user_agent) 
          VALUES (?, 'logout', ?, ?)`,
          [req.user.id, req.ip, req.headers['user-agent']]
        );
      }

      res.json({
        success: true,
        message: 'Đăng xuất thành công.'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi đăng xuất.'
      });
    }
  }

  // Refresh Token
  static async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Không tìm thấy refresh token.'
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      const [users] = await pool.execute(
        `SELECT id, email FROM users WHERE id = ? AND status = 'active'`,
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Token không hợp lệ.'
        });
      }

      const user = users[0];

      // Generate new access token
      const newToken = jwt.sign(
        {
          id: user.id,
          email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      res.json({
        success: true,
        token: newToken
      });

    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Token không hợp lệ.'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Lỗi làm mới token.'
      });
    }
  }

  // Forgot Password
  static async forgotPassword(req, res) {
    const { email } = req.body;

    try {
      const [users] = await pool.execute(
        'SELECT id, name, email FROM users WHERE email = ? AND status = "active"',
        [email]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Email không tồn tại trong hệ thống.'
        });
      }

      const user = users[0];
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // Set expiration (1 hour)
      const resetTokenExpiry = new Date(Date.now() + 3600000);

      await pool.execute(
        `UPDATE users SET 
         reset_password_token = ?, 
         reset_password_expires = ? 
         WHERE id = ?`,
        [resetTokenHash, resetTokenExpiry, user.id]
      );

      // Send reset email
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: 'Đặt lại mật khẩu - Smart Restaurant',
        html: `
          <h2>Đặt lại mật khẩu</h2>
          <p>Xin chào ${user.name},</p>
          <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng nhấp vào liên kết bên dưới:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Liên kết này sẽ hết hạn sau 1 giờ.</p>
          <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
        `
      });

      res.json({
        success: true,
        message: 'Email đặt lại mật khẩu đã được gửi.'
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi gửi email đặt lại mật khẩu.'
      });
    }
  }

  // Reset Password
  static async resetPassword(req, res) {
    const { token, password } = req.body;

    try {
      // Hash the token to compare with database
      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      const [users] = await pool.execute(
        `SELECT id, reset_password_expires 
         FROM users 
         WHERE reset_password_token = ? 
         AND status = 'active'`,
        [resetTokenHash]
      );

      if (users.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Token không hợp lệ hoặc đã hết hạn.'
        });
      }

      const user = users[0];
      
      // Check if token has expired
      if (new Date() > user.reset_password_expires) {
        return res.status(400).json({
          success: false,
          error: 'Token đã hết hạn.'
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Update password and clear reset token
      await pool.execute(
        `UPDATE users SET 
         password_hash = ?, 
         reset_password_token = NULL, 
         reset_password_expires = NULL,
         updated_at = NOW()
         WHERE id = ?`,
        [passwordHash, user.id]
      );

      // Invalidate all existing tokens
      await redisClient.setEx(`password_changed:${user.id}`, 3600, 'true');

      res.json({
        success: true,
        message: 'Mật khẩu đã được đặt lại thành công.'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi đặt lại mật khẩu.'
      });
    }
  }

  // Change Password (authenticated)
  static async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
      // Get current password hash
      const [users] = await pool.execute(
        'SELECT password_hash FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Người dùng không tồn tại.'
        });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Mật khẩu hiện tại không đúng.'
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPassword, salt);

      // Update password
      await pool.execute(
        'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
        [newPasswordHash, userId]
      );

      // Invalidate all existing tokens
      await redisClient.setEx(`password_changed:${userId}`, 3600, 'true');

      // Log password change
      await pool.execute(
        `INSERT INTO audit_logs 
        (user_id, action, ip_address, details) 
        VALUES (?, 'password_change', ?, ?)`,
        [userId, req.ip, JSON.stringify({ changedAt: new Date() })]
      );

      res.json({
        success: true,
        message: 'Mật khẩu đã được thay đổi thành công.'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi thay đổi mật khẩu.'
      });
    }
  }

  // Helper: Send verification code
  static async sendVerificationCode(phone, email, code) {
    try {
      // Send SMS (integration with provider like Twilio, Vonage, etc.)
      if (phone) {
        // Implement SMS sending logic
        console.log(`Sending SMS to ${phone}: Verification code: ${code}`);
      }

      // Send Email
      if (email) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: 'Mã xác thực - Smart Restaurant',
          html: `
            <h2>Mã xác thực của bạn</h2>
            <p>Mã xác thực: <strong>${code}</strong></p>
            <p>Mã này có hiệu lực trong 10 phút.</p>
            <p>Nếu bạn không yêu cầu mã xác thực, vui lòng bỏ qua email này.</p>
          `
        });
      }
    } catch (error) {
      console.error('Send verification code error:', error);
      throw error;
    }
  }

  // Get current user profile
  static async getProfile(req, res) {
    try {
      const user = req.user;
      
      // Get additional user info
      const [users] = await pool.execute(
        `SELECT u.*, r.name as role_name, r.permissions,
                re.name as restaurant_name, b.name as branch_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN restaurants re ON u.restaurant_id = re.id
         LEFT JOIN branches b ON u.branch_id = b.id
         WHERE u.id = ?`,
        [user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Người dùng không tồn tại.'
        });
      }

      const userData = users[0];
      
      res.json({
        success: true,
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          role: userData.role_name,
          restaurant_id: userData.restaurant_id,
          branch_id: userData.branch_id,
          restaurant_name: userData.restaurant_name,
          branch_name: userData.branch_name,
          permissions: JSON.parse(userData.permissions || '[]'),
          created_at: userData.created_at,
          last_login: userData.last_login
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi lấy thông tin người dùng.'
      });
    }
  }
}

module.exports = AuthController;