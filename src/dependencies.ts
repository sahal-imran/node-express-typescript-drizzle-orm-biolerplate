import { db, checkDatabase } from './database/client.js';
import { createUserRepository } from './modules/users/user.repository.js';
import { createUserService } from './modules/users/user.service.js';
import type { UserService } from './modules/users/user.service.js';

export type AppDependencies = {
  userService: UserService;
  checkDatabase: () => Promise<boolean>;
};

export const userRepository = createUserRepository(db);
export const userService = createUserService(userRepository);
export const dependencies: AppDependencies = { userService, checkDatabase };
