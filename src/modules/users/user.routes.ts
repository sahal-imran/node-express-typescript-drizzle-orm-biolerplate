import { Router } from 'express';
import { createUserHandlers } from './user.handlers.js';
import type { UserService } from './user.service.js';

export function createUserRouter(service: UserService): Router {
  const router = Router();
  const handlers = createUserHandlers(service);
  router.get('/', handlers.listUsers);
  router.get('/:id', handlers.getUser);
  router.post('/', handlers.createUser);
  router.patch('/:id', handlers.updateUser);
  router.delete('/:id', handlers.removeUser);
  return router;
}
