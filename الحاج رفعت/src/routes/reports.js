const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const profitController = require('../controllers/profitController');

router.get('/daily', reportsController.getDailySummary);
router.get('/money-in', reportsController.getMoneyIn);
router.get('/money-out', reportsController.getMoneyOut);
router.get('/customers-outstanding', reportsController.getCustomersOutstanding);

router.get('/zara-details', reportsController.getZaraDetails);

router.get('/overdue/pdf', reportsController.downloadOverduePDF);
router.get('/overdue/excel', reportsController.downloadOverdueExcel);

// صافي الربح - Net Profit Report
router.get('/profit', profitController.getProfitReport);

module.exports = router;
