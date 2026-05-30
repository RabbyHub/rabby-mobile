const mockToastIndicator = jest.fn();
const mockT = jest.fn((key: string) => key);

jest.mock('@/components2024/Toast', () => ({
  toastIndicator: (...args: unknown[]) => mockToastIndicator(...args),
}));

jest.mock('i18next', () => ({
  t: (...args: unknown[]) => mockT(...args),
}));

import { toastUnlocking } from './toastUnlocking';

describe('toastUnlocking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the unlocking toast as a top indicator', () => {
    toastUnlocking();

    expect(mockT).toHaveBeenCalledWith('page.unlock.unlocking');
    expect(mockToastIndicator).toHaveBeenCalledWith('page.unlock.unlocking', {
      isTop: true,
    });
  });
});
