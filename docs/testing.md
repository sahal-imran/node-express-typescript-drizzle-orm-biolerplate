# Testing

Vitest runs unit and HTTP integration tests. Unit tests inject repository doubles; Supertest exercises Express middleware. CI supplies PostgreSQL and applies migrations before validation. Add repository integration coverage against that isolated database as features grow.
