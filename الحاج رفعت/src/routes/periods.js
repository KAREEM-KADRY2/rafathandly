const express = require('express');
const router = express.Router();
const periodsController = require('../controllers/periodsController');

router.get('/', periodsController.getPeriods);
router.get('/active', periodsController.getActivePeriod);
router.post('/start-new', periodsController.startNewPeriod);
router.post('/:id/close', periodsController.closePeriod);
router.post('/:id/reopen', periodsController.reopenPeriod);

module.exports = router;
