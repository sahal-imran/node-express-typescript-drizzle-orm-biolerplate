import '../setup-env.js';
import { describe, expect, it } from 'vitest';
import { createUserSchema, listUsersSchema } from '@/modules/users/user.validation.js';
describe('validation', () => {
  it('normalizes email', () =>
    expect(createUserSchema.parse({ name: 'Sahal Imran', email: 'SAHAL@EXAMPLE.COM' }).email).toBe(
      'sahal@example.com',
    ));
  it('rejects bad values', () =>
    expect(() => createUserSchema.parse({ name: 'x', email: 'bad' })).toThrow());
  it('defaults pagination', () =>
    expect(listUsersSchema.parse({})).toMatchObject({ page: 1, limit: 20 }));
});
