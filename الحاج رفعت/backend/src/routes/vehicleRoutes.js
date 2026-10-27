const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');

router.get('/', vehicleController.getAllVehicles);
router.post('/', vehicleController.createVehicle);
router.get('/:id/report', vehicleController.getVehicleReport);
router.get('/:id/report/pdf', vehicleController.downloadVehicleReportPDF);
router.get('/:id', vehicleController.getVehicleById);
router.put('/:id', vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);

module.exports = router;
