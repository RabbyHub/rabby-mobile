import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import { ScreenHeaderAccountTitle } from './OnScreenHeader';

// Component coverage: the display-only header must render the account it is
// given and never read or write scene account state.
const mockUseSceneAccountInfo = jest.fn();
const mockSwitchSceneCurrentAccount = jest.fn();
jest.mock('@/hooks/accountsSwitcher', () => ({
  useSceneAccountInfo: (...args: unknown[]) => mockUseSceneAccountInfo(...args),
  useSwitchSceneCurrentAccount: () => ({
    switchSceneCurrentAccount: mockSwitchSceneCurrentAccount,
    toggleUseAllAccountsOnScene: jest.fn(),
  }),
  usePreFetchBeforeEnterScene: () => ({ preFetchData: jest.fn() }),
}));
jest.mock('./hooks', () => ({
  useAccountSceneVisible: () => ({
    isVisible: false,
    toggleSceneVisible: jest.fn(),
  }),
}));
jest.mock('../Perf/PerfDetector', () => ({
  useRendererDetect: jest.fn(),
}));
jest.mock('../CustomTouchableOpacity', () => ({
  CustomTouchableOpacity: require('react-native').View,
}));
jest.mock('@/components2024/AddressItem/AddressItem', () => ({
  AddressItem: ({
    children,
  }: {
    children: (props: { WalletIcon: () => null }) => React.ReactNode;
  }) => children({ WalletIcon: () => null }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {}, isLight: true }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const ADDRESS = '0x341a1fbd51825e5a107db54ccb3166deba145479';
const account = (aliasName?: string) =>
  ({
    address: ADDRESS,
    type: 'Simple Key Pair',
    brandName: 'Simple Key Pair',
    aliasName,
  } as KeyringAccountWithAlias);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ScreenHeaderAccountTitle', () => {
  it('shows the alias of the account it is given, without scene state', () => {
    render(
      <ScreenHeaderAccountTitle
        titleText="Swapped"
        account={account('Hongbo')}
      />,
    );

    expect(screen.getByText('Swapped')).toBeTruthy();
    expect(screen.getByText('Hongbo')).toBeTruthy();
    expect(mockUseSceneAccountInfo).not.toHaveBeenCalled();
    expect(mockSwitchSceneCurrentAccount).not.toHaveBeenCalled();
  });

  it('falls back to the shortened address when there is no alias', () => {
    render(<ScreenHeaderAccountTitle titleText="Sent" account={account()} />);

    expect(screen.getByText('0x341a1f...145479')).toBeTruthy();
  });

  it('renders only the title when no account is known', () => {
    render(<ScreenHeaderAccountTitle titleText="Received" account={null} />);

    expect(screen.getByText('Received')).toBeTruthy();
    expect(screen.queryByText(/0x341a1f/)).toBeNull();
  });
});
