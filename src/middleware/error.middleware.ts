import type { Request, Response } from "express";
import { AppError } from "../utils/errors";

// it requires _next: NextFunction - removed because of eslint 
export function errorMiddleware(err: unknown, _req: Request, res: Response) {
    // Known errors
    if (err instanceof AppError) {
        return res.status(err.status).json({
            ok: false,
            error: { code: err.code, message: err.message, details: err.details },
        });
    }

    // fallback
    return res.status(500).json({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
    });
}