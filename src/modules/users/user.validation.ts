import { z } from 'zod';
export const idSchema = z.uuid();
export const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z
      .email()
      .max(320)
      .transform((v) => v.trim().toLowerCase()),
    status: z.enum(['active', 'inactive']).default('active'),
  })
  .strict();
export const updateUserSchema = createUserSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');
export const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(['name', 'email', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
