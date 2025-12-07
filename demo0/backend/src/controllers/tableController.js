const Table = require('../models/tableModel');

const tableController = {
  getAllTables: async (req, res) => {
    try {
      const tables = await Table.getAll();
      res.json({
        success: true,
        data: tables
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách bàn',
        error: error.message
      });
    }
  },

  getTableById: async (req, res) => {
    try {
      const table = await Table.getById(req.params.id);
      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bàn'
        });
      }
      res.json({
        success: true,
        data: table
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin bàn',
        error: error.message
      });
    }
  },

  createTable: async (req, res) => {
    try {
      const tableId = await Table.create(req.body);
      const newTable = await Table.getById(tableId);
      res.status(201).json({
        success: true,
        message: 'Tạo bàn thành công',
        data: newTable
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo bàn',
        error: error.message
      });
    }
  },

  updateTable: async (req, res) => {
    try {
      await Table.update(req.params.id, req.body);
      const updatedTable = await Table.getById(req.params.id);
      res.json({
        success: true,
        message: 'Cập nhật bàn thành công',
        data: updatedTable
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật bàn',
        error: error.message
      });
    }
  },

  deleteTable: async (req, res) => {
    try {
      await Table.delete(req.params.id);
      res.json({
        success: true,
        message: 'Xóa bàn thành công'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa bàn',
        error: error.message
      });
    }
  },

  updateTableStatus: async (req, res) => {
    try {
      const { status } = req.body;
      if (!['available', 'occupied', 'reserved'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Trạng thái không hợp lệ'
        });
      }
      
      await Table.update(req.params.id, { status });
      const updatedTable = await Table.getById(req.params.id);
      res.json({
        success: true,
        message: 'Cập nhật trạng thái thành công',
        data: updatedTable
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật trạng thái',
        error: error.message
      });
    }
  },

  generateQR: async (req, res) => {
    try {
      const { tableId } = req.params;
      const { baseUrl } = req.body;
      
      const result = await Table.generateQR(tableId, baseUrl || req.headers.origin);
      
      res.json({
        success: true,
        message: 'Đã tạo QR code thành công',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo QR code',
        error: error.message
      });
    }
  },

  generateAllQR: async (req, res) => {
    try {
      const { baseUrl } = req.body;
      
      const result = await Table.generateAllQR(baseUrl || req.headers.origin);
      
      res.json({
        success: true,
        message: 'Đã tạo QR code cho tất cả bàn',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo QR code',
        error: error.message
      });
    }
  }
};

module.exports = tableController;