// routes/auditRoutes.js
import express from 'express';                              // 1) Router
import { protect, requireAdminOrSuper } from '../middlewares/authMiddleware.js'; // 2) RBAC guards
import { listAudit } from '../controllers/auditController.js'; // 3) Controller

const router = express.Router();                            // 4) Router instance

// GET /api/audit
router.get('/', protect, requireAdminOrSuper, listAudit);   // 5) Secure list

export default router;                                      // 6) Export
