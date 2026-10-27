const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');

// Dashboard & Partners CRUD
router.get('/dashboard', partnerController.getDashboard);
router.get('/', partnerController.getPartners);
router.post('/', partnerController.createPartner);
router.get('/:id', partnerController.getPartnerById);
router.put('/:id', partnerController.updatePartner);
router.patch('/:id/archive', partnerController.archivePartner);
router.patch('/:id/unarchive', partnerController.unarchivePartner);
router.delete('/:id', partnerController.deletePartner);

// Partner Transactions
router.get('/:id/transactions', partnerController.getPartnerTransactions);
router.post('/:id/transactions', partnerController.createTransaction);
router.post('/:id/transactions/:txId/return', partnerController.recordReturn);
router.post('/transactions/:txId/return', partnerController.recordReturn);
router.put('/:id/transactions/:txId', partnerController.updateTransaction);
router.put('/transactions/:txId', partnerController.updateTransaction);
router.delete('/:id/transactions/:txId', partnerController.deleteTransaction);
router.delete('/transactions/:txId', partnerController.deleteTransaction);
router.post('/transactions/:txId/cancel', partnerController.deleteTransaction);

// Statements & Exports
router.get('/:id/statement', partnerController.getPartnerStatement);
router.get('/:id/statement/pdf', partnerController.downloadPartnerStatementPDF);
router.get('/:id/statement/excel', partnerController.downloadPartnerStatementExcel);

module.exports = router;
