const User = require('../models/usermodel');

const userController = {
  register: async (req, res) => {
    try {
      const { username, email, password, full_name, phone, role } = req.body;
      
      const existingUser = await User.getByUsername(username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username đã tồn tại'
        });
      }
      
      const existingEmail = await User.getByEmail(email);
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email đã được sử dụng'
        });
      }
      
      const password_hash = await User.hashPassword(password);
      
      const userId = await User.create({
        username,
        email,
        password_hash,
        full_name,
        phone,
        role: role || 'staff'
      });
      
      const newUser = await User.getById(userId);
      
      res.status(201).json({
        success: true,
        message: 'Đăng ký thành công',
        data: newUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi đăng ký',
        error: error.message
      });
    }
  },

  login: async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await User.getByUsername(username);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Tài khoản không tồn tại'
        });
      }
      
      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Tài khoản đã bị vô hiệu hóa'
        });
      }
      
      const isValidPassword = await User.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Mật khẩu không chính xác'
        });
      }
      
      await User.updateLastLogin(user.id);
      
      const { password_hash, ...userData } = user;
      
      res.json({
        success: true,
        message: 'Đăng nhập thành công',
        data: userData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi đăng nhập',
        error: error.message
      });
    }
  },

  getAllUsers: async (req, res) => {
    try {
      const { role, status, search, page = 1, limit = 10 } = req.query;
      
      const filters = {};
      if (role) filters.role = role;
      if (status) filters.status = status;
      if (search) filters.search = search;
      
      const offset = (page - 1) * limit;
      filters.offset = offset;
      filters.limit = parseInt(limit);
      
      const users = await User.getAll(filters);
      
      res.json({
        success: true,
        data: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi lấy danh sách người dùng',
        error: error.message
      });
    }
  },

  getUserById: async (req, res) => {
    try {
      const user = await User.getById(req.params.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi lấy thông tin người dùng',
        error: error.message
      });
    }
  },

  updateUser: async (req, res) => {
    try {
      const affectedRows = await User.update(req.params.id, req.body);
      
      if (affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng hoặc không có thay đổi'
        });
      }
      
      const updatedUser = await User.getById(req.params.id);
      
      res.json({
        success: true,
        message: 'Cập nhật thành công',
        data: updatedUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi cập nhật người dùng',
        error: error.message
      });
    }
  },

  deleteUser: async (req, res) => {
    try {
      const affectedRows = await User.delete(req.params.id);
      
      if (affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }
      
      res.json({
        success: true,
        message: 'Đã vô hiệu hóa tài khoản thành công'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi xóa người dùng',
        error: error.message
      });
    }
  },

  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.params.id;
      
      const user = await User.getById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }
      
      const fullUser = await User.getByUsername(user.username);
      
      const isValidPassword = await User.verifyPassword(currentPassword, fullUser.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Mật khẩu hiện tại không chính xác'
        });
      }
      
      const newPasswordHash = await User.hashPassword(newPassword);
      
      await User.updatePassword(userId, newPasswordHash);
      
      res.json({
        success: true,
        message: 'Đổi mật khẩu thành công'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi đổi mật khẩu',
        error: error.message
      });
    }
  }
};

module.exports = userController;