import { Router } from "express";
import { signIn, signOut, signUp, getProfile } from "../controllers/auth.controller.js";
import authorize from "../middlewares/auth.middleware.js";

const authRouter = Router();

authRouter.post('/sign-up',signUp);
authRouter.post('/sign-in',signIn);
authRouter.post('/sign-out',signOut);
authRouter.get('/me', authorize, getProfile);

export default authRouter;