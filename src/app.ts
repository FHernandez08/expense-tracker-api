// Express app wired together

import express from "express";
import { healthRouter } from "./routes/health.routes";
import { errorMiddleware } from "./middleware/error.middleware";

export function createApp() {
    const app = express();

    app.use(express.json());

    // Routes
    app.use(healthRouter);

    // 404 error
    app.use((_req, res) => {
        res.status(404).json({
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Route not found' }
        });
    });

    // Error handler
    app.use(errorMiddleware);

    return app;
}