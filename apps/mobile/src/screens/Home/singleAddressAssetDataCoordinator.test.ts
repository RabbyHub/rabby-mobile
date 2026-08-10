import { createSingleAddressAssetDataCoordinator } from './singleAddressAssetDataCoordinator';

const ADDRESS = '0xAbCd';
const NORMALIZED_ADDRESS = ADDRESS.toLowerCase();

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createDependencies() {
  return {
    loadDefi: jest.fn<Promise<void>, [string]>(() => Promise.resolve()),
    loadNft: jest.fn<Promise<void>, [string]>(() => Promise.resolve()),
    registerDefi: jest.fn<void, [string, string | undefined]>(),
    registerNft: jest.fn<void, [string, string | undefined]>(),
  };
}

describe('singleAddressAssetDataCoordinator', () => {
  it('prepares both projections without loading data', () => {
    const dependencies = createDependencies();
    const coordinator = createSingleAddressAssetDataCoordinator(dependencies);

    coordinator.prepare({ address: ADDRESS, chainServerId: 'eth' });

    expect(dependencies.registerDefi).toHaveBeenCalledWith(
      NORMALIZED_ADDRESS,
      'eth',
    );
    expect(dependencies.registerNft).toHaveBeenCalledWith(
      NORMALIZED_ADDRESS,
      'eth',
    );
    expect(dependencies.loadDefi).not.toHaveBeenCalled();
    expect(dependencies.loadNft).not.toHaveBeenCalled();
  });

  it('warms DeFi before NFT so idle work does not start both domains together', async () => {
    const dependencies = createDependencies();
    const defi = createDeferred();
    dependencies.loadDefi.mockReturnValue(defi.promise);
    const coordinator = createSingleAddressAssetDataCoordinator(dependencies);

    const warmup = coordinator.warm({
      address: ADDRESS,
      chainServerId: 'eth',
    });
    await Promise.resolve();

    expect(dependencies.loadDefi).toHaveBeenCalledTimes(1);
    expect(dependencies.loadNft).not.toHaveBeenCalled();

    defi.resolve();
    await warmup;

    expect(dependencies.loadNft).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests for the same address and domain', async () => {
    const dependencies = createDependencies();
    const defi = createDeferred();
    dependencies.loadDefi.mockReturnValue(defi.promise);
    const coordinator = createSingleAddressAssetDataCoordinator(dependencies);

    const first = coordinator.ensure('defi', { address: ADDRESS });
    const second = coordinator.ensure('defi', { address: ADDRESS });
    await Promise.resolve();

    expect(dependencies.loadDefi).toHaveBeenCalledTimes(1);

    defi.resolve();
    await Promise.all([first, second]);
  });

  it('reuses only recent successful work', async () => {
    const dependencies = createDependencies();
    let now = 1_000;
    const coordinator = createSingleAddressAssetDataCoordinator({
      ...dependencies,
      now: () => now,
      reuseMs: 100,
    });

    await coordinator.ensure('nft', { address: ADDRESS });
    now += 99;
    await coordinator.ensure('nft', { address: ADDRESS });
    expect(dependencies.loadNft).toHaveBeenCalledTimes(1);

    now += 1;
    await coordinator.ensure('nft', { address: ADDRESS });
    expect(dependencies.loadNft).toHaveBeenCalledTimes(2);
  });

  it('allows an immediate retry after a failed warmup', async () => {
    const dependencies = createDependencies();
    dependencies.loadDefi
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce();
    const coordinator = createSingleAddressAssetDataCoordinator(dependencies);

    await expect(
      coordinator.ensure('defi', { address: ADDRESS }),
    ).rejects.toThrow('network unavailable');
    await coordinator.ensure('defi', { address: ADDRESS });

    expect(dependencies.loadDefi).toHaveBeenCalledTimes(2);
  });
});
