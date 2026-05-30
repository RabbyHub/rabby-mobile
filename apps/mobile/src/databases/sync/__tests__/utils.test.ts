import { NFTItemEntity } from '../../entities/nftItem';
import { ProtocolItemEntity } from '../../entities/portocolItem';
import { updateExpiredTime, wrapAbortableFn } from '../utils';

jest.mock('../../entities/nftItem', () => ({
  NFTItemEntity: {
    willExpired: jest.fn(),
  },
}));

jest.mock('../../entities/portocolItem', () => ({
  ProtocolItemEntity: {
    willExpired: jest.fn(),
  },
}));

const mockNFTWillExpired = NFTItemEntity.willExpired as jest.MockedFunction<
  typeof NFTItemEntity.willExpired
>;
const mockProtocolWillExpired =
  ProtocolItemEntity.willExpired as jest.MockedFunction<
    typeof ProtocolItemEntity.willExpired
  >;

describe('database sync utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateExpiredTime', () => {
    it('lowercases addresses and updates NFT/protocol expiration together', async () => {
      await updateExpiredTime('0x00000000000000000000000000000000000000AA', 60);

      expect(mockNFTWillExpired).toHaveBeenCalledWith(
        '0x00000000000000000000000000000000000000aa',
        60,
      );
      expect(mockProtocolWillExpired).toHaveBeenCalledWith(
        '0x00000000000000000000000000000000000000aa',
        60,
      );
    });

    it('logs and swallows expiration update errors', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(jest.fn());
      mockNFTWillExpired.mockRejectedValueOnce(new Error('db failed'));

      await expect(updateExpiredTime('0xabc')).resolves.toBeUndefined();

      expect(logSpy).toHaveBeenCalledWith('update expired', expect.any(Error));
      logSpy.mockRestore();
    });
  });

  describe('wrapAbortableFn', () => {
    let logSpy: jest.SpyInstance;
    let debugSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(jest.fn());
      debugSpy = jest.spyOn(console, 'debug').mockImplementation(jest.fn());
      errorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    });

    afterEach(() => {
      logSpy.mockRestore();
      debugSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('runs the wrapped function with an abort signal and calls onFinally', async () => {
      const fn = jest.fn(async () => undefined);
      const onFinally = jest.fn();
      const abortable = wrapAbortableFn({
        label: 'run-once',
        fn,
        onFinally,
      });

      await abortable.run();

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
      expect(onFinally).toHaveBeenCalledWith(fn.mock.calls[0][0]);
    });

    it('aborts the previous run when another run starts with the same label', async () => {
      const resolvers: Array<() => void> = [];
      const seenSignals: AbortSignal[] = [];
      const fn = jest.fn(signal => {
        seenSignals.push(signal);
        return new Promise<void>(resolve => {
          resolvers.push(resolve);
        });
      });
      const abortable = wrapAbortableFn({
        label: 'same-label',
        fn,
      });

      const firstRun = abortable.run();
      const secondRun = abortable.run();

      expect(seenSignals[0].aborted).toBe(true);
      expect(seenSignals[1].aborted).toBe(false);
      resolvers.forEach(resolve => resolve());
      await Promise.all([firstRun, secondRun]);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('exposes abort and getAbortController helpers for the active run', async () => {
      let resolveRun: () => void = jest.fn();
      const abortable = wrapAbortableFn({
        label: 'manual-abort',
        fn: jest.fn(
          () =>
            new Promise<void>(resolve => {
              resolveRun = resolve;
            }),
        ),
      });

      const run = abortable.run();
      const controller = abortable.getAbortController();
      expect(controller?.signal.aborted).toBe(false);

      abortable.abort();
      expect(controller?.signal.aborted).toBe(true);
      resolveRun();
      await run;
    });

    it('propagates an external abort controller to the active request', async () => {
      let resolveRun: () => void = jest.fn();
      const externalController = new AbortController();
      const externalControllerRef = {
        current: externalController,
      };
      const abortable = wrapAbortableFn({
        label: 'external-abort',
        externalControllerRef,
        fn: jest.fn(
          () =>
            new Promise<void>(resolve => {
              resolveRun = resolve;
            }),
        ),
      });

      const run = abortable.run();
      const internalController = abortable.getAbortController();
      expect(internalController?.signal.aborted).toBe(false);

      externalController.abort();
      expect(internalController?.signal.aborted).toBe(true);
      resolveRun();
      await run;
    });
  });
});
