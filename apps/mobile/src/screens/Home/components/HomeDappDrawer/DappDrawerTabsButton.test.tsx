import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { DappDrawerTabsButton } from './DappDrawerTabsButton';

// Component contract: the count comes from the tabs store hook and a press
// opens the tab manager. The store and the manager sheet are replaced here.
let mockTabsCount = 0;
const mockSetPartialBrowserState = jest.fn();

jest.mock('@/hooks/browser/useBrowser', () => ({
  browserApis: {
    setPartialBrowserState: (...args: unknown[]) =>
      mockSetPartialBrowserState(...args),
  },
  useDisplayedTabsCount: () => mockTabsCount,
}));

jest.mock('@/assets2024/icons/browser', () => ({
  RcIconTabsCC: () => null,
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));

describe('DappDrawerTabsButton', () => {
  beforeEach(() => {
    mockTabsCount = 0;
    mockSetPartialBrowserState.mockClear();
  });

  it('shows zero when no dapp tab is open', () => {
    const screen = render(<DappDrawerTabsButton />);

    expect(screen.getByText('0')).toBeTruthy();
  });

  it('shows the open dapp tab count', () => {
    mockTabsCount = 3;
    const screen = render(<DappDrawerTabsButton />);

    expect(screen.getByText('3')).toBeTruthy();
  });

  it('caps the count at 99+', () => {
    mockTabsCount = 120;
    const screen = render(<DappDrawerTabsButton />);

    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('opens the tab manager on press', () => {
    mockTabsCount = 2;
    const screen = render(<DappDrawerTabsButton />);

    fireEvent.press(screen.getByTestId('home-dapp-drawer-tabs-button'));

    expect(mockSetPartialBrowserState).toHaveBeenCalledWith({
      isShowManage: true,
    });
  });
});
