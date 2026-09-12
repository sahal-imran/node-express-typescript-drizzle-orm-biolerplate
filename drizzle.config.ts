import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';
export default defineConfig({
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/app',
  },
  strict: true,
  verbose: true,
});
