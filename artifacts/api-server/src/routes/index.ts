import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import jobsRouter from "./jobs";
import studentRouter from "./student";
import recruiterRouter from "./recruiter";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(jobsRouter);
router.use(studentRouter);
router.use(recruiterRouter);
router.use(aiRouter);

export default router;
