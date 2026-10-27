const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.get('/:id/account-statement', customerController.getCustomerAccountStatement);
router.get('/:id/account-statement/pdf', customerController.downloadCustomerStatementPDF);
router.get('/:id/account-statement/excel', customerController.downloadCustomerStatementExcel);
router.get('/:id/whatsapp-statement', customerController.getWhatsappStatement);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
