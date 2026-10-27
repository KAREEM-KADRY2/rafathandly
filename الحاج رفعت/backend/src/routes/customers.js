const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const creditSaleController = require('../controllers/creditSaleController');

router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.get('/:id/account-statement', customerController.getCustomerAccountStatement);
router.get('/:id/account-statement/pdf', customerController.downloadCustomerStatementPDF);
router.get('/:id/account-statement/excel', customerController.downloadCustomerStatementExcel);
router.get('/:id/whatsapp-statement', customerController.getWhatsappStatement);
router.post('/:id/adjustments', customerController.createAdjustment);
router.post('/:id/zara', customerController.createAdjustment);
router.delete('/:id/adjustments/:adjustmentId', customerController.deleteAdjustment);
router.delete('/:id/zara/:adjustmentId', customerController.deleteAdjustment);
router.delete('/:id/payments/:paymentId', creditSaleController.deletePayment);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
