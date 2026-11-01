const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

router.post('/', purchaseController.createPurchase);
router.get('/supplier/:supplierId', purchaseController.getPurchasesBySupplier);
router.get('/supplier/:supplierId/open-invoices', purchaseController.getSupplierOpenInvoices);
router.get('/:id/pdf', purchaseController.downloadPurchaseInvoicePDF);
router.get('/:id', purchaseController.getPurchaseById);
router.post('/payments', purchaseController.recordSupplierPayment);
router.put('/:id', purchaseController.updatePurchase);
router.delete('/:id', purchaseController.deletePurchase);
router.post('/:id/cancel', purchaseController.deletePurchase);

module.exports = router;
