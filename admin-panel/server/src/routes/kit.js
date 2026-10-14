const express = require('express')
const controller = require('../controllers/kitController')
const { diskUpload } = require('../middleware/upload')

const router = express.Router()

// Existing single-kit integrations
router.get('/', controller.getActiveKit)
router.put('/', controller.saveKit)

router.post(
  '/image',
  diskUpload.single('image'),
  controller.uploadLegacyImage
)

// Multiple kits management
router.get('/kits', controller.listKits)
router.get('/products', controller.listKitProducts)
router.get('/matching', controller.matchingKits)

router.post('/kits', controller.createKit)

router.get('/kits/:id', controller.getKitById)

router.put('/kits/:id', controller.updateKit)

router.patch(
  '/kits/:id/active',
  controller.toggleKit
)

router.delete(
  '/kits/:id',
  controller.deleteKit
)

router.post(
  '/kits/:id/image',
  diskUpload.single('image'),
  controller.uploadKitImage
)

module.exports = router


