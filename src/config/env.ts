import 'dotenv/config';
import { z } from 'zod';
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((x) => x.trim())),
  TRUST_PROXY: bool.default(false),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
export const env = Object.freeze(parsed.data);
