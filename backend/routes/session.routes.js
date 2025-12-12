import { Router } from "express";
import { getUserSessionsHistory } from "../controllers/session.controller.js";
import authorize from "../middlewares/auth.middleware.js";

const sessionRouter = Router();

sessionRouter.use(authorize);

sessionRouter.get("/", getUserSessionsHistory);

export default sessionRouter;

