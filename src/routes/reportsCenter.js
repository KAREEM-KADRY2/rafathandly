const express = require('express');
const router = express.Router();
const reportsCenterController = require('../controllers/reportsCenterController');

router.get('/sales', reportsCenterController.getSalesReport);
router.get('/purchases', reportsCenterController.getPurchasesReport);
router.get('/customers', reportsCenterController.getCustomersReport);
router.get('/customer/:id', reportsCenterController.getSingleCustomerReport);
router.get('/profit-loss', reportsCenterController.getProfitLossReport);
router.get('/products', reportsCenterController.getProductsReport);
router.get('/product/:id', reportsCenterController.getSingleProductReport);
router.get('/collections', reportsCenterController.getCollectionsReport);
router.get('/expenses', reportsCenterController.getExpensesReport);
router.get('/treasury', reportsCenterController.getTreasuryReport);
router.get('/comprehensive', reportsCenterController.getComprehensiveReport);

module.exports = router;
