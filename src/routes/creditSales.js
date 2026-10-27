const express = require('express');
const router = express.Router();
const creditSaleController = require('../controllers/creditSaleController');

// These routes could be nested under customers, but we'll use top-level or customer id as needed
router.get('/grouped', creditSaleController.getGroupedSales);
router.get('/', creditSaleController.getAllSales);
router.get('/customer/:id', creditSaleController.getCustomerCreditSales);
router.get('/customer/:id/prices', creditSaleController.getCustomerPrices);
router.get('/:id', creditSaleController.getCreditSaleById);
router.post('/', creditSaleController.createCreditSale);
router.post('/:id/payments', creditSaleController.addPayment);
router.put('/:id', creditSaleController.updateCreditSale);
router.post('/:id/cancel', creditSaleController.cancelSale);

module.exports = router;
