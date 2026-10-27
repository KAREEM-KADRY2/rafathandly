const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.post('/company', settingsController.updateCompanyInfo);
router.get('/user', settingsController.getUserInfo);
router.put('/user', settingsController.updateUserInfo);
router.put('/user/password', settingsController.changePassword);
router.put('/inventory-password', settingsController.changeInventoryAdjustmentPassword);
router.get('/backup/info', settingsController.getBackupInfo);
router.get('/backup/download', settingsController.downloadBackup);
router.get('/backup/download-json', settingsController.downloadReadableBackup);
router.post('/backup/restore', upload.single('backup_file'), settingsController.restoreBackup);

module.exports = router;
