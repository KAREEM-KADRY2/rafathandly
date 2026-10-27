const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

router.get('/summary', inventoryController.getSummary);
router.get('/items', inventoryController.getItems);
router.post('/items', inventoryController.createItem);
router.get('/items/:id', inventoryController.getItemById);
router.get('/items/:id/movements', inventoryController.getItemMovements);
router.get('/items/:id/purchases', inventoryController.getItemPurchases);
router.get('/items/:id/sales', inventoryController.getItemSales);
router.post('/verify-password', inventoryController.verifyAdjustmentPassword);
router.post('/adjustments', inventoryController.createAdjustment);

router.put('/items/:id', inventoryController.updateItem);
router.delete('/items/:id', inventoryController.deleteItem);
module.exports = router;
