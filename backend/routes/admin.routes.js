import { Router } from "express";
import adminAuthorize from "../middlewares/admin.middleware.js";
import {
  getUsers,
  updateUserRole,
  getAdminStats,
  getAllActiveSessionsForAdmin,
  runAdminSessionCommand,
  getAdminSessionLogs,
  getAdminSessionResources,
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
} from "../controllers/admin.controller.js";
import { getAdminSessionsHistory } from "../controllers/session.controller.js";

const adminRouter = Router();

adminRouter.use(adminAuthorize);

adminRouter.get("/users", getUsers);
adminRouter.post("/users", createUserAccount);
adminRouter.patch("/users/:id", updateUserAccount);
adminRouter.patch("/users/:id/role", updateUserRole);
adminRouter.delete("/users/:id", deleteUserAccount);
adminRouter.get("/stats", getAdminStats);
adminRouter.get("/sessions", getAllActiveSessionsForAdmin);
adminRouter.get("/sessions/history", getAdminSessionsHistory);
adminRouter.post("/sessions/:sessionId/terminal", runAdminSessionCommand);
adminRouter.get("/sessions/:sessionId/logs", getAdminSessionLogs);
adminRouter.get("/sessions/:sessionId/resources", getAdminSessionResources);

export default adminRouter;
