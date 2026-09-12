import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDatabase, db } from './client.js';
import { logger } from '@/shared/logger.js';
try {
  await migrate(db, { migrationsFolder: 'src/database/migrations' });
  logger.info('Migrations applied');
} finally {
  await closeDatabase();
}
