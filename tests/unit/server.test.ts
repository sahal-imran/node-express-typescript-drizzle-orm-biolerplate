import '../setup-env.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkDatabase: vi.fn<() => Promise<boolean>>(),
  closeDatabase: vi.fn<() => Promise<void>>(),
  createApp: vi.fn(),
  listen: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
}));
vi.mock('@/database/client.js', () => ({
  checkDatabase: mocks.checkDatabase,
  closeDatabase: mocks.closeDatabase,
}));
vi.mock('@/app.js', () => ({ createApp: mocks.createApp }));
vi.mock('node:http', () => ({ createServer: () => ({ listen: mocks.listen }) }));
vi.mock('@/shared/logger.js', () => ({
  logger: { info: mocks.info, error: mocks.error, fatal: mocks.fatal },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.closeDatabase.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('server startup', () => {
  it('waits for database connectivity before creating the app or listening', async () => {
    let completeCheck: (ready: boolean) => void = () => {
      throw Error('Database check not initialized');
    };
    const check = new Promise<boolean>((resolve) => {
      completeCheck = resolve;
    });
    mocks.checkDatabase.mockReturnValue(check);
    vi.spyOn(process, 'on').mockReturnValue(process);
    const startup = import('@/server.js');
    await vi.waitFor(() => expect(mocks.checkDatabase).toHaveBeenCalledOnce());
    expect(mocks.createApp).not.toHaveBeenCalled();
    expect(mocks.listen).not.toHaveBeenCalled();
    completeCheck(true);
    await startup;
    expect(mocks.createApp).toHaveBeenCalledOnce();
    expect(mocks.listen).toHaveBeenCalledOnce();
    expect(mocks.closeDatabase).not.toHaveBeenCalled();
    expect(mocks.info).toHaveBeenCalledWith('Database connectivity check passed');
  });

  it.each([false, true])(
    'aborts startup and exits with failure (cleanup fails: %s)',
    async (cleanupFails) => {
      mocks.checkDatabase.mockResolvedValue(false);
      const cleanupError = Error('cleanup failed');
      if (cleanupFails) mocks.closeDatabase.mockRejectedValue(cleanupError);
      const exitError = Error('process exited');
      const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw exitError;
      });
      await expect(import('@/server.js')).rejects.toBe(exitError);
      expect(mocks.fatal).toHaveBeenCalledWith(
        'Database connectivity check failed; API startup aborted',
      );
      expect(mocks.closeDatabase).toHaveBeenCalledOnce();
      expect(exit).toHaveBeenCalledWith(1);
      expect(mocks.createApp).not.toHaveBeenCalled();
      expect(mocks.listen).not.toHaveBeenCalled();
      if (cleanupFails)
        expect(mocks.error).toHaveBeenCalledWith(
          { err: cleanupError },
          'Database cleanup failed during startup',
        );
    },
  );
});
