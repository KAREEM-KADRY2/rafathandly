const express = require('express');
const router = express.Router();
const transportController = require('../controllers/transportController');

router.post('/', transportController.createTransportTrip);
router.put('/:id', transportController.updateTransportTrip);
router.delete('/:id', transportController.deleteTransportTrip);
router.get('/', transportController.getAllTrips);
router.get('/purchase/:purchaseId', transportController.getTripsByPurchase);
router.get('/supplier/:supplierId', transportController.getTripsBySupplier);
router.post('/:id/collect', transportController.collectNawlon);
router.get('/supplier/:supplierId/freight-transactions', transportController.getFreightTransactions);

router.get('/vehicle/:id', transportController.getTripsByVehicle);
router.get('/vehicle/:id/reports', transportController.getVehicleReports);

module.exports = router;
