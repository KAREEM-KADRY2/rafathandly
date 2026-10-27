const express = require('express');
const router = express.Router();
const workerController = require('../controllers/workerController');

// Workers CRUD
router.get('/', workerController.getAllWorkers);
router.post('/', workerController.createWorker);
router.put('/:id', workerController.updateWorker);
router.delete('/:id', workerController.deleteWorker);
router.get('/:id/summary', workerController.getWorkerSummary);

// Attendance
router.get('/attendance/daily', workerController.getDailyAttendance);
router.post('/attendance/batch', workerController.saveBatchAttendance);
router.get('/:id/attendance', workerController.getWorkerAttendance);
router.post('/:id/attendance/daily', workerController.saveDailyAttendance);
router.delete('/attendance/:attendanceId', workerController.deleteAttendance);

// Withdrawals
router.get('/:id/withdrawals', workerController.getWorkerWithdrawals);
router.post('/:id/withdrawals', workerController.createWithdrawal);
router.delete('/withdrawals/:id', workerController.deleteWithdrawal);


// Advanced Attendance & Leaves
router.post('/:id/attendance/start', workerController.startWork);
router.post('/:id/attendance/end', workerController.endWork);
router.get('/:id/attendance/advanced', workerController.getWorkerAttendanceWithHours);
router.get('/:id/attendance/summary', workerController.getMonthlySummary);

router.get('/:id/leaves', workerController.getWorkerLeaves);
router.post('/:id/leaves', workerController.createLeave);
router.delete('/leaves/:leaveId', workerController.deleteLeave);

module.exports = router;
