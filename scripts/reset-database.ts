import { env } from '../src/config/env.js';
import { closeDatabase, pool } from '../src/database/client.js';
if (env.NODE_ENV === 'production') throw new Error('Database reset is disabled in production');
await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await closeDatabase();
console.log('Database reset; now run npm run db:migrate');
