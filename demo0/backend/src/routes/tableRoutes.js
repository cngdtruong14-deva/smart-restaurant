const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');

router.get('/', tableController.getAllTables);
router.get('/:id', tableController.getTableById);
router.post('/', tableController.createTable);
router.put('/:id', tableController.updateTable);
router.delete('/:id', tableController.deleteTable);
router.put('/:id/status', tableController.updateTableStatus);
router.post('/:id/generate-qr', tableController.generateQR);
router.post('/generate-all-qr', tableController.generateAllQR);

module.exports = router;