import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
});

export const env = EnvSchema.parse(process.env);
