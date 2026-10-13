
const express = require('express');
const studentsController = require('../controllers/studentsController');
const { memoryUpload } = require('../middleware/upload');

const router = express.Router();

router.get('/', studentsController.listStudents);

router.get(
  '/classes',
  studentsController.listStudentClasses
);

router.get('/export', studentsController.exportCsv);
router.get('/template', studentsController.downloadTemplate);

router.post(
  '/import/preview',
  memoryUpload.single('file'),
  studentsController.importPreview
);

router.post(
  '/import/commit',
  memoryUpload.single('file'),
  studentsController.importCommit
);

router.post(
  '/bulk-active',
  studentsController.bulkActive
);

router.get('/:id', studentsController.getStudent);
router.post('/', studentsController.createStudent);
router.patch('/:id', studentsController.updateStudent);

router.patch(
  '/:id/controls',
  studentsController.updateControls
);

router.delete('/:id', studentsController.deleteStudent);

module.exports = router;




// const express = require('express');
// const studentsController = require('../controllers/studentsController');
// const { memoryUpload } = require('../middleware/upload');
// const router = express.Router();

// router.get('/', studentsController.listStudents);
// router.get('/export', studentsController.exportCsv);
// router.get('/template', studentsController.downloadTemplate);
// router.post(
//   '/import/preview',
//   memoryUpload.single('file'),
//   studentsController.importPreview
// );
// router.post(
//   '/import/commit',
//   memoryUpload.single('file'),
//   studentsController.importCommit
// );
// router.post('/bulk-active', studentsController.bulkActive);
// router.get('/:id', studentsController.getStudent);
// router.post('/', studentsController.createStudent);
// router.patch('/:id', studentsController.updateStudent);
// router.patch('/:id/controls', studentsController.updateControls);
// router.delete('/:id', studentsController.deleteStudent);

// module.exports = router;
