import '../setup-env.js';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '@/app.js';
import { createUserService } from '@/modules/users/user.service.js';
import type { UserRepository } from '@/modules/users/user.repository.js';
import { createAppError } from '@/shared/errors.js';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Sahal',
  email: 'sahal@example.com',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
function setup(overrides: Partial<UserRepository> = {}, ready = true) {
  const repository: UserRepository = {
    create: vi.fn(async () => user),
    findById: async () => user,
    list: async () => ({ items: [user], total: 1 }),
    update: async () => user,
    softDelete: async () => true,
    ...overrides,
  };
  return {
    repository,
    app: createApp({
      userService: createUserService(repository),
      checkDatabase: async () => ready,
    }),
  };
}
describe('composed application', () => {
  it('preserves CRUD response contracts', async () => {
    const { app, repository } = setup();
    const created = await request(app)
      .post('/api/v1/users')
      .send({ name: 'Sahal', email: 'SAHAL@EXAMPLE.COM' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ success: true, data: { id: user.id } });
    expect(repository.create).toHaveBeenCalledWith({
      name: 'Sahal',
      email: user.email,
      status: 'active',
    });
    const retrieved = await request(app).get(`/api/v1/users/${user.id}`);
    expect(retrieved.status).toBe(200);
    expect(retrieved.body).toEqual(created.body);
    const updated = await request(app).patch(`/api/v1/users/${user.id}`).send({ name: 'Changed' });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(created.body);
    const deleted = await request(app).delete(`/api/v1/users/${user.id}`);
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe('');
    const listed = await request(app).get('/api/v1/users');
    expect(listed.body).toMatchObject({
      success: true,
      data: [created.body.data],
      meta: { page: 1, limit: 20, total: 1, pages: 1 },
    });
  });
  it('rejects invalid bodies, IDs and pagination', async () => {
    const { app } = setup();
    const responses = [
      await request(app).post('/api/v1/users').send({ name: 'x', email: 'bad' }),
      await request(app).get('/api/v1/users/bad'),
      await request(app).get('/api/v1/users?limit=101'),
    ];
    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.length).toBeGreaterThan(0);
    }
  });
  it('preserves the existing default status on empty updates', async () => {
    const update = vi.fn(async () => user);
    const { app } = setup({ update });
    await request(app).patch(`/api/v1/users/${user.id}`).send({}).expect(200);
    expect(update).toHaveBeenCalledWith(user.id, { status: 'active' });
  });
  it('propagates structured errors and details through async handlers', async () => {
    const { app } = setup({
      findById: async () => {
        throw createAppError(409, 'CONFLICT', 'Conflict', { field: 'email' });
      },
    });
    const response = await request(app)
      .get(`/api/v1/users/${user.id}`)
      .set('x-request-id', 'functional-error');
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Conflict',
        details: { field: 'email' },
        requestId: 'functional-error',
      },
    });
  });
  it('hides unexpected error details', async () => {
    const { app } = setup({
      findById: async () => {
        throw new Error('private');
      },
    });
    const response = await request(app).get(`/api/v1/users/${user.id}`);
    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
    expect(response.body.error).not.toHaveProperty('details');
  });
  it('returns 404 after soft deletion', async () => {
    let deleted = false;
    const { app } = setup({
      softDelete: async () => {
        deleted = true;
        return true;
      },
      findById: async () => (deleted ? undefined : user),
    });
    await request(app).delete(`/api/v1/users/${user.id}`).expect(204);
    const response = await request(app).get(`/api/v1/users/${user.id}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });
  it.each([true, false])('injects readiness: %s', async (ready) => {
    const { app } = setup({}, ready);
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(ready ? 200 : 503);
    expect(response.body).toEqual({
      success: ready,
      data: { status: ready ? 'ready' : 'not_ready' },
    });
    await request(app).get('/health/live').expect(200);
    await request(app).get('/health').expect(307).expect('Location', '/health/ready');
    await request(app).get('/').expect(200);
    await request(app).get('/docs/openapi.json').expect(200);
  });
});
