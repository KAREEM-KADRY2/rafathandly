const express = require('express');
const router = express.Router();
const stressTestService = require('../services/stressTestService');
const db = require('../db');
const path = require('path');

const DEMO_DB_PATH = path.resolve(__dirname, '../db/company_accounts_demo.db');
const TEST_DB_PATH = stressTestService.getTestDbPath();

// Get live status
router.get('/status', (req, res) => {
    try {
        const status = stressTestService.getStatus();
        res.json(status);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Start stress test data generation
router.post('/start', (req, res) => {
    try {
        const customTargets = req.body.targets || {};
        stressTestService.startStressTest(customTargets);
        res.json({ message: 'بدأ اختبار الضغط في الخلفية', status: stressTestService.getStatus() });
    } catch(err) {
        res.status(400).json({ error: err.message });
    }
});

// Stop stress test
router.post('/stop', (req, res) => {
    try {
        stressTestService.stopStressTest();
        res.json({ message: 'تم إرسال طلب إيقاف اختبار الضغط' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete test data
router.post('/delete', async (req, res) => {
    try {
        const status = await stressTestService.purgeTestData();
        res.json({ message: 'تم مسح جميع بيانات الاختبار بنجاح', status });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Switch active database connection between Production & Test
router.post('/switch-db', (req, res) => {
    try {
        const { mode } = req.body; // 'test' or 'production'
        const targetPath = mode === 'test' ? TEST_DB_PATH : DEMO_DB_PATH;
        db.switchDatabase(targetPath);
        res.json({
            message: `تم تبديل قاعدة البيانات الحالية إلى: ${mode === 'test' ? 'قاعدة البيانات الاختبارية (TEST DB)' : 'قاعدة البيانات الحقيقية (PRODUCTION DB)'}`,
            activeDbPath: db.getActiveDatabasePath(),
            isTestDb: db.isTestDatabase()
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Run concurrency load benchmark
router.post('/concurrency', async (req, res) => {
    try {
        const levels = req.body.levels || [10, 25, 50, 100];
        const results = await stressTestService.runConcurrencyBenchmark(levels);
        res.json({ message: 'تم تنفيذ اختبار الأحمال المتزامنة بنجاح', results });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Run integrity audit
router.get('/audit', (req, res) => {
    try {
        const auditResults = stressTestService.auditIntegrity();
        res.json(auditResults);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Run failure & rollback tests
router.post('/failure-tests', (req, res) => {
    try {
        const testResults = stressTestService.runFailureTests();
        res.json({ message: 'تم تنفيذ سيناريوهات اختبار الفشل بنجاح', testResults });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate and get full evaluation report
router.get('/report', async (req, res) => {
    try {
        const report = await stressTestService.generateFullReport();
        res.json(report);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
