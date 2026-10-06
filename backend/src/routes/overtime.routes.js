import { Router } from "express";
import { overtimeController } from "../controllers/overtimeController.js";
import { listOvertimeValidator, reviewOvertimeValidator } from "../validators/overtimeValidators.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../authorization/requirePermission.js";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("overtime.read"), listOvertimeValidator, overtimeController.list);
router.patch("/:id/review", requirePermission("overtime.approve"), reviewOvertimeValidator, overtimeController.review);

export default router;
