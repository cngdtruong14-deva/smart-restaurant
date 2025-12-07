const express = require('express');
const router = express.Router();
const userController = require('../controllers/usersController');

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);

// Protected routes (cần thêm middleware auth sau)
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.put('/:id/change-password', userController.changePassword);

module.exports = router;