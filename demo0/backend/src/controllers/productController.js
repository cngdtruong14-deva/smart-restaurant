const Product = require('../models/productModel');
const pool = require('../config/database');

const productController = {
  getAllProducts: async (req, res) => {
    try {
      const products = await Product.getAll();
      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách sản phẩm',
        error: error.message
      });
    }
  },

  getProductById: async (req, res) => {
    try {
      const product = await Product.getById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy sản phẩm'
        });
      }
      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin sản phẩm',
        error: error.message
      });
    }
  },

  getProductsByCategory: async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM products WHERE category = ? AND is_available = TRUE',
        [req.params.category]
      );
      res.json({
        success: true,
        data: rows
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy sản phẩm theo danh mục',
        error: error.message
      });
    }
  },

  createProduct: async (req, res) => {
    try {
      const productId = await Product.create(req.body);
      const newProduct = await Product.getById(productId);
      res.status(201).json({
        success: true,
        message: 'Tạo sản phẩm thành công',
        data: newProduct
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo sản phẩm',
        error: error.message
      });
    }
  },

  updateProduct: async (req, res) => {
    try {
      await Product.update(req.params.id, req.body);
      const updatedProduct = await Product.getById(req.params.id);
      res.json({
        success: true,
        message: 'Cập nhật sản phẩm thành công',
        data: updatedProduct
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật sản phẩm',
        error: error.message
      });
    }
  },

  deleteProduct: async (req, res) => {
    try {
      await Product.delete(req.params.id);
      res.json({
        success: true,
        message: 'Xóa sản phẩm thành công'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa sản phẩm',
        error: error.message
      });
    }
  },

  updateProductAvailability: async (req, res) => {
    try {
      const { is_available } = req.body;
      await pool.query(
        'UPDATE products SET is_available = ? WHERE id = ?',
        [is_available, req.params.id]
      );
      const updatedProduct = await Product.getById(req.params.id);
      res.json({
        success: true,
        message: 'Cập nhật trạng thái thành công',
        data: updatedProduct
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật trạng thái',
        error: error.message
      });
    }
  }
};

module.exports = productController;