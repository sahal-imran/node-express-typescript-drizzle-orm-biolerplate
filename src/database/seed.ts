import { closeDatabase, db } from './client.js';
import { users } from './schema.js';
await db
  .insert(users)
  .values({ name: 'Demo User', email: 'demo@example.com' })
  .onConflictDoNothing();
await closeDatabase();
