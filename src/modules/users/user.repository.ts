import { and, asc, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import type { Database } from '@/database/client.js';
import { users, type User } from '@/database/schema.js';
import type { CreateUserInput, ListUsersInput, UpdateUserInput } from './user.validation.js';
export interface UserRepository {
  create(this: void, i: CreateUserInput): Promise<User>;
  findById(this: void, id: string): Promise<User | undefined>;
  list(this: void, i: ListUsersInput): Promise<{ items: User[]; total: number }>;
  update(this: void, id: string, i: UpdateUserInput): Promise<User | undefined>;
  softDelete(this: void, id: string): Promise<boolean>;
}
export function createUserRepository(database: Database): UserRepository {
  return {
    async create(i) {
      const [u] = await database.insert(users).values(i).returning();
      if (!u) throw new Error('Insert returned no user');
      return u;
    },
    async findById(id) {
      return (
        await database
          .select()
          .from(users)
          .where(and(eq(users.id, id), isNull(users.deletedAt)))
          .limit(1)
      )[0];
    },
    async list(i) {
      const f = [isNull(users.deletedAt)];
      if (i.status) f.push(eq(users.status, i.status));
      if (i.search)
        f.push(or(ilike(users.name, `%${i.search}%`), ilike(users.email, `%${i.search}%`))!);
      const where = and(...f),
        cols = { name: users.name, email: users.email, createdAt: users.createdAt },
        direction = i.order === 'asc' ? asc : desc;
      const [items, total] = await Promise.all([
        database
          .select()
          .from(users)
          .where(where)
          .orderBy(direction(cols[i.sort]), asc(users.id))
          .limit(i.limit)
          .offset((i.page - 1) * i.limit),
        database.select({ value: count() }).from(users).where(where),
      ]);
      return { items, total: total[0]?.value ?? 0 };
    },
    async update(id, i) {
      return (
        await database
          .update(users)
          .set({ ...i, updatedAt: new Date() })
          .where(and(eq(users.id, id), isNull(users.deletedAt)))
          .returning()
      )[0];
    },
    async softDelete(id) {
      return (
        (
          await database
            .update(users)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .returning({ id: users.id })
        ).length > 0
      );
    },
  };
}
