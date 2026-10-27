const express = require('express');
const router = express.Router();
const otherExpenseController = require('../controllers/otherExpenseController');

router.get('/', otherExpenseController.getAllOtherExpenses);
router.post('/', otherExpenseController.addOtherExpense);
router.get('/summary', otherExpenseController.getOtherExpensesSummary);
router.get('/names', otherExpenseController.getUniqueExpenseNames);
router.put('/:id', otherExpenseController.updateOtherExpense);
router.delete('/:id', otherExpenseController.cancelOtherExpense);

module.exports = router;
