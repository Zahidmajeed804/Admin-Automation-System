import { Router } from "express";
import { leaveController } from "../controllers/leaveController.js";
import {
  createLeaveValidator,
  listLeaveValidator,
  reviewLeaveValidator,
} from "../validators/leaveValidators.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission, requireAnyPermission } from "../authorization/requirePermission.js";
import { ForbiddenError } from "../errors/AppError.js";

const router = Router();

router.use(authenticate);

// Approving and rejecting are separate permissions. The gate above lets either
// through; this checks the one that matches the decision, after the validator
// has confirmed the decision is one of the two known values.
const permissionForDecision = { approved: "leave.approve", rejected: "leave.reject" };
const requireDecisionPermission = (req, res, next) => {
  const needed = permissionForDecision[req.body.decision];
  if (!req.permissions.includes(needed)) {
    throw new ForbiddenError(`Missing required permission: ${needed}`);
  }
  next();
};

router.get("/", requirePermission("leave.read"), listLeaveValidator, leaveController.list);
router.post("/", requirePermission("leave.create"), createLeaveValidator, leaveController.create);
router.patch(
  "/:id/review",
  requireAnyPermission(["leave.approve", "leave.reject"]),
  reviewLeaveValidator,
  requireDecisionPermission,
  leaveController.review
);

export default router;
