import { Router } from "express";
import { generatorController } from "../controllers/generatorController.js";
import { generatorLogController } from "../controllers/generatorLogController.js";
import { generatorMaintenanceController } from "../controllers/generatorMaintenanceController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../authorization/requirePermission.js";
import {
  createGeneratorValidator,
  updateGeneratorValidator,
  createGeneratorLogValidator,
  createMaintenanceValidator,
  updateMaintenanceValidator,
  maintenanceAlertsValidator,
} from "../validators/generatorValidators.js";

const router = Router();

// Every route here requires authentication + the database-resolved
// "generator.*" permission — never a hardcoded role check.
router.use(authenticate);

// Logs — must be declared BEFORE the "/:id" routes below, otherwise
// GET /generator/logs is captured by "/:id" with id = "logs".
router.get("/logs", requirePermission("generator.read"), generatorLogController.list);
router.post("/logs", requirePermission("generator.create"), createGeneratorLogValidator, generatorLogController.create);
router.delete("/logs/:logId", requirePermission("generator.delete"), generatorLogController.remove);

// Maintenance — same reason as logs: "/maintenance" must be declared before
// "/:id" (and "/maintenance/alerts" before "/maintenance/:id").
router.get("/maintenance/alerts", requirePermission("generator.read"), maintenanceAlertsValidator, generatorMaintenanceController.alerts);
router.get("/maintenance", requirePermission("generator.read"), generatorMaintenanceController.list);
router.post("/maintenance", requirePermission("generator.create"), createMaintenanceValidator, generatorMaintenanceController.create);
router.patch("/maintenance/:id", requirePermission("generator.update"), updateMaintenanceValidator, generatorMaintenanceController.update);
router.delete("/maintenance/:id", requirePermission("generator.delete"), generatorMaintenanceController.remove);

router.get("/", requirePermission("generator.read"), generatorController.list);
router.post("/", requirePermission("generator.create"), createGeneratorValidator, generatorController.create);
router.get("/:id", requirePermission("generator.read"), generatorController.getById);
router.patch(
  "/:id",
  requirePermission("generator.update"),
  updateGeneratorValidator,
  generatorController.update
);
router.delete("/:id", requirePermission("generator.delete"), generatorController.remove);

export default router;
