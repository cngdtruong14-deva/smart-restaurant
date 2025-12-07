const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');
const authMiddleware = require('../middleware/auth');

// Tất cả route order cần xác thực (cho nhân viên)
router.use(authMiddleware.verifyToken);

router.get('/', OrderController.getAll);
router.get('/:id', OrderController.getById);
router.post('/', OrderController.create);
router.put('/:id/status', OrderController.updateStatus);

module.exports = router;