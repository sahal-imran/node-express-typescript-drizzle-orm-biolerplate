import { DatabaseError } from 'pg';
import { createAppError } from '@/shared/errors.js';
import type { UserRepository } from './user.repository.js';
import type { CreateUserInput, ListUsersInput, UpdateUserInput } from './user.validation.js';

import type { User } from '@/database/schema.js';

export type UserListResult = {
  items: User[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};
export interface UserService {
  create(input: CreateUserInput): Promise<User>;
  get(id: string): Promise<User>;
  list(input: ListUsersInput): Promise<UserListResult>;
  update(id: string, input: UpdateUserInput): Promise<User>;
  remove(id: string): Promise<void>;
}

export function createUserService(repo: UserRepository): UserService {
  async function create(i: CreateUserInput): Promise<User> {
    try {
      return await repo.create(i);
    } catch (e) {
      if (e instanceof DatabaseError && e.code === '23505')
        throw createAppError(409, 'EMAIL_EXISTS', 'A user with this email already exists');
      throw e;
    }
  }
  async function get(id: string): Promise<User> {
    const u = await repo.findById(id);
    if (!u) throw createAppError(404, 'USER_NOT_FOUND', 'User not found');
    return u;
  }
  async function list(i: ListUsersInput): Promise<UserListResult> {
    const r = await repo.list(i);
    return { ...r, page: i.page, limit: i.limit, pages: Math.ceil(r.total / i.limit) };
  }
  async function update(id: string, i: UpdateUserInput): Promise<User> {
    const u = await repo.update(id, i);
    if (!u) throw createAppError(404, 'USER_NOT_FOUND', 'User not found');
    return u;
  }
  async function remove(id: string): Promise<void> {
    if (!(await repo.softDelete(id))) throw createAppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  return { create, get, list, update, remove };
}
