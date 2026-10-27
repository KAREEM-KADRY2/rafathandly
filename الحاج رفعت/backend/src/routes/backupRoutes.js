const express = require('express');
const router = express.Router();
const backupService = require('../services/backupService');

// Get list of available database backups
router.get('/', (req, res) => {
    try {
        const backups = backupService.listBackups();
        res.json(backups);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Create manual backup now
router.post('/create', (req, res) => {
    try {
        const { notes } = req.body;
        const result = backupService.createBackup(notes || 'نسخة احتياطية يدوية بطلب من المدير');
        res.json(result);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
