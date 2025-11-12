//routes/userSettingsRoutes.js

import express from "express";
import {protect} from "../middlewares/authMiddleware.js";
import { getMySettings,updateMySettings } from "../controllers/userSettingsController.js";

const router = express.Router();

router.get("/",protect,getMySettings);
router.patch("/",protect,updateMySettings);

export default router;