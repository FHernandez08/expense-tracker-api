import { Router } from "express";
import { ok } from '../utils/response';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
    return ok(res, { ok: true });
});