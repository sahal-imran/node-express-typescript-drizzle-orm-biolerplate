import type { Request, Response } from 'express';
import type { UserService } from './user.service.js';
import {
  createUserSchema,
  idSchema,
  listUsersSchema,
  updateUserSchema,
} from './user.validation.js';

export function createUserHandlers(service: UserService) {
  async function listUsers(req: Request, res: Response): Promise<void> {
    const query = listUsersSchema.parse(req.query);
    const { items, total, ...meta } = await service.list(query);
    res.json({ success: true, data: items, meta: { ...meta, total } });
  }
  async function getUser(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: await service.get(idSchema.parse(req.params.id)) });
  }
  async function createUser(req: Request, res: Response): Promise<void> {
    res
      .status(201)
      .json({ success: true, data: await service.create(createUserSchema.parse(req.body)) });
  }
  async function updateUser(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: await service.update(idSchema.parse(req.params.id), updateUserSchema.parse(req.body)),
    });
  }
  async function removeUser(req: Request, res: Response): Promise<void> {
    await service.remove(idSchema.parse(req.params.id));
    res.status(204).send();
  }
  return { listUsers, getUser, createUser, updateUser, removeUser };
}
