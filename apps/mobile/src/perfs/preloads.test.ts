import { RootNames } from '@/constant/layout';

const mockComponent = jest.fn(async () => undefined);
const mockIsCached = jest.fn(() => false);

jest.mock('@/constant', () => ({
  isNonPublicProductionEnv: false,
}));

jest.mock('react-native-bundle-splitter', () => ({
  isCached: (...args: unknown[]) => mockIsCached(...args),
  preload: () => ({ component: mockComponent }),
}));

import {
  PRELOAD_NAVIGATORS,
  prepareTransactionNavigatorForPerpsNavigation,
} from './preloads';

describe('Perps Transaction navigator preparation', () => {
  beforeEach(() => {
    mockComponent.mockClear();
    mockIsCached.mockClear();
    mockIsCached.mockReturnValue(false);
  });

  it('resolves the registered navigator before an explicit Perps push', async () => {
    await prepareTransactionNavigatorForPerpsNavigation();

    expect(mockComponent).toHaveBeenCalledWith(
      PRELOAD_NAVIGATORS[RootNames.StackTransaction],
    );
  });

  it('does not reload a navigator that bundle-splitter already cached', async () => {
    mockIsCached.mockReturnValue(true);

    await prepareTransactionNavigatorForPerpsNavigation();

    expect(mockComponent).not.toHaveBeenCalled();
  });
});
