import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import {
  runPerpsProAffinityWarmup,
  startPerpsProHomeNavigationIntent,
} from './perpsProAffinityWarmup';

const createDependencies = () => ({
  getAppState: jest.fn<'active' | 'background' | 'inactive' | 'unknown', []>(
    () => 'active',
  ),
  getViewMode: jest.fn<Promise<'simple' | 'pro'>, []>(async () => 'pro'),
  loadWarmupOwner: jest.fn(async () => ({
    prewarmPerpsProHomeAffinity: jest.fn(async () => true),
  })),
});

describe('Perps Pro affinity startup task', () => {
  it('is registered as low-priority post-Home idle work', () => {
    expect(STARTUP_TASKS.perpsProAffinityWarmup).toEqual(
      expect.objectContaining({
        priority: 'low',
        stage: 'homePostStartupIdle',
      }),
    );
  });

  it('does not read preferences or load Pro while the app is inactive', async () => {
    const dependencies = createDependencies();
    dependencies.getAppState.mockReturnValue('background');

    await expect(runPerpsProAffinityWarmup(dependencies)).resolves.toBe(false);
    expect(dependencies.getViewMode).not.toHaveBeenCalled();
    expect(dependencies.loadWarmupOwner).not.toHaveBeenCalled();
  });

  it('does not load the Pro owner for a persisted Simple user', async () => {
    const dependencies = createDependencies();
    dependencies.getViewMode.mockResolvedValue('simple');

    await expect(runPerpsProAffinityWarmup(dependencies)).resolves.toBe(false);
    expect(dependencies.loadWarmupOwner).not.toHaveBeenCalled();
  });

  it('rechecks AppState before loading and before starting network work', async () => {
    const dependencies = createDependencies();
    dependencies.getAppState
      .mockReturnValueOnce('active')
      .mockReturnValueOnce('active')
      .mockReturnValueOnce('background');
    const owner = await dependencies.loadWarmupOwner();
    dependencies.loadWarmupOwner.mockResolvedValue(owner);
    dependencies.loadWarmupOwner.mockClear();

    await expect(runPerpsProAffinityWarmup(dependencies)).resolves.toBe(false);
    expect(dependencies.loadWarmupOwner).toHaveBeenCalledTimes(1);
    expect(owner.prewarmPerpsProHomeAffinity).not.toHaveBeenCalled();
  });

  it('loads and runs the owner once for an active persisted Pro user', async () => {
    const dependencies = createDependencies();
    const owner = await dependencies.loadWarmupOwner();
    dependencies.loadWarmupOwner.mockResolvedValue(owner);
    dependencies.loadWarmupOwner.mockClear();

    await expect(runPerpsProAffinityWarmup(dependencies)).resolves.toBe(true);
    expect(dependencies.loadWarmupOwner).toHaveBeenCalledTimes(1);
    expect(owner.prewarmPerpsProHomeAffinity).toHaveBeenCalledTimes(1);
  });
});

describe('Perps Pro Home navigation intent gate', () => {
  const createNavigationDependencies = () => ({
    getViewMode: jest.fn<Promise<'simple' | 'pro'>, []>(async () => 'pro'),
    loadWarmupOwner: jest.fn(async () => ({
      prewarmPerpsProHomeNavigationIntent: jest.fn(async () => true),
    })),
  });

  it('does not load the Pro owner for a persisted Simple user', async () => {
    const dependencies = createNavigationDependencies();
    dependencies.getViewMode.mockResolvedValue('simple');

    await expect(startPerpsProHomeNavigationIntent(dependencies)).resolves.toBe(
      false,
    );
    expect(dependencies.loadWarmupOwner).not.toHaveBeenCalled();
  });

  it('loads the Pro owner after the persisted-mode gate passes', async () => {
    const dependencies = createNavigationDependencies();
    const owner = await dependencies.loadWarmupOwner();
    dependencies.loadWarmupOwner.mockResolvedValue(owner);
    dependencies.loadWarmupOwner.mockClear();

    await expect(startPerpsProHomeNavigationIntent(dependencies)).resolves.toBe(
      true,
    );
    expect(dependencies.loadWarmupOwner).toHaveBeenCalledTimes(1);
    expect(owner.prewarmPerpsProHomeNavigationIntent).toHaveBeenCalledTimes(1);
  });
});
