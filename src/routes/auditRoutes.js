const express = require('express');
const router = express.Router();
const auditLogger = require('../controllers/auditLogger');

router.get('/', auditLogger.getLogs);

module.exports = router;
