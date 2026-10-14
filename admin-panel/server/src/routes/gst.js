const express = require('express');
const gstController = require('../controllers/gstController');

const router = express.Router();

router.get('/documents', gstController.documents);
router.get('/summary', gstController.summary);
router.get('/rate-wise', gstController.rateWise);
router.get('/hsn-wise', gstController.hsnWise);
router.get('/download', gstController.download);

router.get('/export', gstController.exportXlsx);
router.get('/register', gstController.gstRegister);

router.get('/profile', gstController.getProfile);
router.put('/profile', gstController.putProfile);
router.get('/email-schedule', gstController.getEmailSchedule);
router.put('/email-schedule', gstController.putEmailSchedule);
router.post('/send-test-email', gstController.sendTestEmail);
router.get('/tax-mapping', gstController.taxMapping);
router.post('/tax-mapping/bulk', gstController.bulkTax);
router.patch('/tax-mapping/:id', gstController.patchProductTax);

router.get('/register', gstController.gstRegister);

router.get(
  '/register/export',
  gstController.gstRegisterExport
);

module.exports = router;
