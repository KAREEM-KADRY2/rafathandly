const express = require('express');
const router = express.Router();
const treasuryController = require('../controllers/treasuryController');

router.get('/accounts', treasuryController.getAccounts);
router.post('/accounts', treasuryController.addAccount);
router.put('/accounts/:id', treasuryController.updateAccount);
router.delete('/accounts/:id', treasuryController.deleteAccount);
router.get('/transactions', treasuryController.getTransactions);
router.post('/transfer', treasuryController.transfer);

router.post('/voucher', treasuryController.createVoucher);
router.put('/voucher/:id', treasuryController.updateVoucher);
router.delete('/voucher/:id', treasuryController.deleteVoucher);

module.exports = router;
