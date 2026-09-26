import express from "express";
import AuthController from "../controllers/Auth.ts";
import AuthValidator from "../validators/Auth.ts";

const router = express.Router();

router.post("/sign-in", AuthValidator.signIn, AuthController.signIn);
router.post("/logout", AuthValidator.logOut, AuthController.logOut);
router.post("/refresh", AuthValidator.refresh, AuthController.refresh);

export default router;
