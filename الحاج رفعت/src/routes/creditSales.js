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
router.delete('/payments/:paymentId', creditSaleController.deletePayment);
router.put('/:id', creditSaleController.updateCreditSale);
router.post('/:id/cancel', creditSaleController.cancelSale);
router.delete('/:id', creditSaleController.cancelSale);
router.post('/:id/zara', (req, res, next) => {
    const saleId = req.params.id;
    const db = require('../db');
    const sale = db.prepare('SELECT customer_id FROM credit_sales WHERE id = ?').get(saleId);
    if (!sale) return res.status(404).json({ error: 'فاتورة المبيعات غير موجودة' });
    req.params.id = sale.customer_id;
    req.body.credit_sale_id = saleId;
    const customerController = require('../controllers/customerController');
    customerController.createAdjustment(req, res, next);
});

module.exports = router;
