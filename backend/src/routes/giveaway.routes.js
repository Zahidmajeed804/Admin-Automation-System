import { Router } from "express";
import { giveawayController } from "../controllers/giveawayController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../authorization/requirePermission.js";
import {
  createItemValidator,
  updateItemValidator,
  stockAdjustValidator,
  issueValidator,
  listItemsQueryValidator,
} from "../validators/giveawayValidators.js";

const router = Router();

router.use(authenticate);

router.get("/dashboard", requirePermission("giveaways.read"), giveawayController.dashboard);

router.get("/issues", requirePermission("giveaways.read"), giveawayController.listIssues);
router.post("/issues", requirePermission("giveaways.issue"), issueValidator, giveawayController.issueItem);

router.get("/", requirePermission("giveaways.read"), listItemsQueryValidator, giveawayController.listItems);
router.post("/", requirePermission("giveaways.create"), createItemValidator, giveawayController.createItem);

router.get("/:id", requirePermission("giveaways.read"), giveawayController.getItem);
router.put("/:id", requirePermission("giveaways.update"), updateItemValidator, giveawayController.updateItem);
router.delete("/:id", requirePermission("giveaways.delete"), giveawayController.deactivateItem);

router.post("/:id/stock-in", requirePermission("giveaways.update"), stockAdjustValidator, giveawayController.stockIn);
router.post("/:id/stock-out", requirePermission("giveaways.update"), stockAdjustValidator, giveawayController.stockOut);

export default router;
