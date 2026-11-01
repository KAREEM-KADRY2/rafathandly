const express = require('express');
const router = express.Router();
const reportsV2Controller = require('../controllers/reportsV2Controller');
const financialPositionController = require('../controllers/financialPositionController');

router.get('/sales', reportsV2Controller.getSales);
router.get('/purchases', reportsV2Controller.getPurchases);
router.get('/profit-loss', reportsV2Controller.getProfitLoss);
router.get('/expenses', reportsV2Controller.getExpenses);
router.get('/inventory-movements', reportsV2Controller.getInventoryMovements);
router.get('/all-products', reportsV2Controller.getAllProducts);
router.get('/customers', reportsV2Controller.getCustomers);
router.get('/suppliers', reportsV2Controller.getSuppliers);
router.get('/partners', reportsV2Controller.getPartners);

// Financial Position & Net Capital Report
router.get('/financial-position', financialPositionController.getFinancialPosition);
router.get('/financial-position/customers', financialPositionController.getCustomersBreakdown);
router.get('/financial-position/suppliers', financialPositionController.getSuppliersBreakdown);
router.get('/financial-position/inventory', financialPositionController.getInventoryBreakdown);
router.get('/financial-position/cash', financialPositionController.getCashBreakdown);
router.get('/financial-position/expenses', financialPositionController.getExpensesBreakdown);
router.get('/financial-position/profit', financialPositionController.getProfitBreakdown);

module.exports = router;
