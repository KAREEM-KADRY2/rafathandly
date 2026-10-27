const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');

router.get('/', supplierController.getAllSuppliers);
router.post('/', supplierController.createSupplier);
router.get('/:id/statement', supplierController.getSupplierAccountStatement);
router.get('/:id/summary', supplierController.getSupplierSummary);
router.get('/:id/statement/pdf', supplierController.downloadSupplierStatementPDF);
router.get('/:id/statement/excel', supplierController.downloadSupplierStatementExcel);
router.get('/:id', supplierController.getSupplierById);
router.put('/:id', supplierController.updateSupplier);
router.delete('/:id', supplierController.deleteSupplier);
router.put('/:id/status', supplierController.toggleSupplierStatus);

// Balance and Transactions
router.get('/:id/balance', supplierController.getSupplierBalance);
router.post('/:id/balance/deposit', supplierController.depositBalance);
router.get('/:id/transactions', supplierController.getTransactions);
router.put('/transactions/:id', supplierController.updateSupplierTransaction);
router.delete('/transactions/:id', supplierController.deleteSupplierTransaction);

module.exports = router;
