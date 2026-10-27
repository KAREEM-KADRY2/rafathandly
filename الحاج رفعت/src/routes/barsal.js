const express = require('express');
const router = express.Router();
const barsalController = require('../controllers/barsalController');

router.get('/names', barsalController.getBarsalNames);
router.get('/report', barsalController.getReport);
router.get('/parcels', barsalController.getParcels);
router.get('/report-v2', barsalController.getReportV2);
router.get('/', barsalController.getAll);
router.get('/:id', barsalController.getById);
router.post('/', barsalController.create);
router.put('/:id', barsalController.update);
router.delete('/:id', barsalController.remove);

module.exports = router;
