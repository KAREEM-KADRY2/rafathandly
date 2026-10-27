const express = require('express');
const router = express.Router();
const reportsV2Controller = require('../controllers/reportsV2Controller');

router.get('/sales', reportsV2Controller.getSales);
router.get('/purchases', reportsV2Controller.getPurchases);
router.get('/profit-loss', reportsV2Controller.getProfitLoss);
router.get('/expenses', reportsV2Controller.getExpenses);
router.get('/inventory-movements', reportsV2Controller.getInventoryMovements);
router.get('/all-products', reportsV2Controller.getAllProducts);
router.get('/customers', reportsV2Controller.getCustomers);
router.get('/suppliers', reportsV2Controller.getSuppliers);

module.exports = router;
