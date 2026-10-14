const express = require('express');
const paymentsController = require('../controllers/paymentsController');

const router = express.Router();

// router.get('/', paymentsController.listPayments);
// router.get('/export', paymentsController.exportPayments);
router.get('/', paymentsController.listPayments);
router.get('/summary', paymentsController.paymentSummary);

module.exports = router;
