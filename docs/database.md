# Database

Drizzle uses a bounded PostgreSQL pool. Type-safe schemas live in `src/database/schema.ts`; immutable SQL migrations live in `src/database/migrations`. Generate, review, commit, and apply migrations independently from API startup.
