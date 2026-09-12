import '../setup-env.js';
import { DatabaseError } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { createUserService } from '@/modules/users/user.service.js';
import type { UserRepository } from '@/modules/users/user.repository.js';
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Sahal',
  email: 'sahal@example.com',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
const repo: UserRepository = {
  create: vi.fn(async () => user),
  findById: vi.fn(async () => user),
  list: vi.fn(async () => ({ items: [user], total: 1 })),
  update: vi.fn(async () => user),
  softDelete: vi.fn(async () => true),
};
describe('service', () => {
  const service = createUserService(repo);
  it('gets user', async () => expect(await service.get(user.id)).toEqual(user));
  it('paginates', async () =>
    expect(
      (await service.list({ page: 1, limit: 20, sort: 'createdAt', order: 'desc' })).pages,
    ).toBe(1));
  it('deletes', async () => expect(service.remove(user.id)).resolves.toBeUndefined());
});

describe('functional service behavior', () => {
  it('creates independent services from injected repositories', async () => {
    const create = vi.fn(async () => user);
    const service = createUserService({ ...repo, create });
    const input = { name: user.name, email: user.email, status: user.status };
    expect(await service.create(input)).toEqual(user);
    expect(create).toHaveBeenCalledWith(input);
    expect(createUserService(repo)).not.toBe(service);
  });
  it('reports missing users on retrieval, update, and deletion', async () => {
    const service = createUserService({
      ...repo,
      findById: async () => undefined,
      update: async () => undefined,
      softDelete: async () => false,
    });
    for (const result of [
      () => service.get(user.id),
      () => service.update(user.id, { name: 'Changed' }),
      () => service.remove(user.id),
    ]) {
      await expect(result()).rejects.toMatchObject({
        type: 'AppError',
        status: 404,
        code: 'USER_NOT_FOUND',
      });
    }
  });
  it('updates through the injected repository', async () => {
    const update = vi.fn(async () => user);
    expect(
      await createUserService({ ...repo, update }).update(user.id, { name: 'Changed' }),
    ).toEqual(user);
    expect(update).toHaveBeenCalledWith(user.id, { name: 'Changed' });
  });
  it('preserves filters and rounds pagination up', async () => {
    const list = vi.fn(async () => ({ items: [user], total: 21 }));
    const input = {
      page: 2,
      limit: 20,
      sort: 'name' as const,
      order: 'asc' as const,
      status: 'active' as const,
      search: 'Sahal',
    };
    expect(await createUserService({ ...repo, list }).list(input)).toEqual({
      items: [user],
      total: 21,
      page: 2,
      limit: 20,
      pages: 2,
    });
    expect(list).toHaveBeenCalledWith(input);
    expect(
      (
        await createUserService({ ...repo, list: async () => ({ items: [], total: 0 }) }).list(
          input,
        )
      ).pages,
    ).toBe(0);
  });
});

describe('database error handling', () => {
  it('maps PostgreSQL unique violations on creation', async () => {
    const error = new DatabaseError('duplicate', 0, 'error');
    error.code = '23505';
    const service = createUserService({
      ...repo,
      create: async () => {
        throw error;
      },
    });
    await expect(
      service.create({ name: user.name, email: user.email, status: user.status }),
    ).rejects.toMatchObject({ type: 'AppError', status: 409, code: 'EMAIL_EXISTS' });
  });
  it.each([new Error('failure'), { code: '23505' }, new DatabaseError('connection', 0, 'error')])(
    'preserves other errors',
    async (error) => {
      const service = createUserService({
        ...repo,
        create: vi.fn<UserRepository['create']>().mockRejectedValue(error),
      });
      await expect(
        service.create({ name: user.name, email: user.email, status: user.status }),
      ).rejects.toBe(error);
    },
  );
  it('preserves existing update error propagation', async () => {
    const error = new DatabaseError('duplicate', 0, 'error');
    error.code = '23505';
    await expect(
      createUserService({
        ...repo,
        update: async () => {
          return Promise.reject(error);
        },
      }).update(user.id, { email: user.email }),
    ).rejects.toBe(error);
  });
});
