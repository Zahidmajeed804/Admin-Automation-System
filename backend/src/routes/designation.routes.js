import { Router } from "express";
import { designationController } from "../controllers/designationController.js";
import {
  listDesignationValidator,
  createDesignationValidator,
  updateDesignationValidator,
} from "../validators/designationValidators.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission, requireAnyPermission } from "../authorization/requirePermission.js";

const router = Router();

router.use(authenticate);

// Read by the Staff page and by attendance managers' designation filters.
router.get(
  "/",
  requireAnyPermission(["users.manage", "attendance.update"]),
  listDesignationValidator,
  designationController.list
);
router.post("/", requirePermission("users.manage"), createDesignationValidator, designationController.create);
router.patch("/:id", requirePermission("users.manage"), updateDesignationValidator, designationController.update);

export default router;
