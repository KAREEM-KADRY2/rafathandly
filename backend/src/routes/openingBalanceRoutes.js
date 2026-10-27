const express = require('express');
const router = express.Router();
const openingBalanceController = require('../controllers/openingBalanceController');

router.get('/:entityType/:entityId', openingBalanceController.getOpeningBalance);
router.post('/', openingBalanceController.saveOpeningBalance);
router.delete('/:entityType/:entityId', openingBalanceController.deleteOpeningBalance);

module.exports = router;
