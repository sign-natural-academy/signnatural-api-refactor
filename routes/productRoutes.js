// routes/productRoutes.js
import express from 'express';
import { createProduct, getProducts , updateProduct, deleteProduct} from '../controllers/productController.js';
import { protect, requireAdmin,requireAdminOrSuper } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validate.js';
import { createProductSchema } from '../validators/productSchemas.js';
import { upload } from '../middlewares/uploads.js';

const router = express.Router();

router.get('/', getProducts);

// Admin-only create with optional image
router.post('/', protect, requireAdminOrSuper, upload.single('image'), validate(createProductSchema), createProduct);
router.patch('/:id', protect, requireAdminOrSuper, upload.single('image'), updateProduct);
router.delete('/:id', protect, requireAdminOrSuper, deleteProduct);

export default router;
