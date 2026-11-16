import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HeaderAccountSwitcher } from '@/components/AccountSwitcher/HeaderAccountSwitcher';
import { MemeCoinHeader } from './MemeCoinHeader';

const mockToastWarning = jest.fn();
const mockToggleSceneVisible = jest.fn();
const mockPreFetchData = jest.fn();

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/utils/address', () => ({
  ellipsisAddress: (address: string) => address,
}));
jest.mock('@/constant/layout', () => ({
  ScreenLayouts: { headerAreaHeight: 44 },
}));
jest.mock('@/hooks/navigation', () => ({ HeaderBackPressable: () => null }));
jest.mock('@/assets2024/memecoin/memecoin-title.svg', () => () => null);
jest.mock('@/assets2024/memecoin/warning.svg', () => () => null);
jest.mock('@/components/Typography', () => ({
  Text: jest.requireActual('react-native').Text,
}));
jest.mock('@/components/Icons/CaretArrowIconCC', () => ({
  CaretArrowIconCC: () => null,
}));
jest.mock('@/components2024/WalletIcon/WalletIcon', () => ({
  WalletIcon: () => {
    const { Text } = jest.requireActual('react-native');
    return <Text>wallet</Text>;
  },
}));
jest.mock('@/components2024/Toast', () => ({
  toastWithIcon:
    () =>
    (...args: unknown[]) =>
      mockToastWarning(...args),
}));
jest.mock('@/core/apis', () => ({
  apiContact: { getAliasName: () => '' },
}));
jest.mock('@/hooks/accountsSwitcher', () => ({
  switchSceneCurrentAccount: jest.fn(),
  usePreFetchBeforeEnterScene: () => ({ preFetchData: mockPreFetchData }),
  useSceneAccountInfo: () => ({
    isSceneUsingAllAccounts: false,
    finalSceneCurrentAccount: { address: '0xabc', brandName: 'Rabby' },
  }),
}));
jest.mock('@/components/AccountSwitcher/hooks', () => ({
  useAccountSceneVisible: () => ({
    isVisible: false,
    toggleSceneVisible: mockToggleSceneVisible,
  }),
}));

describe('MemeCoinHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('warns instead of opening the switcher where switching is disabled', () => {
    const { getByText } = render(<MemeCoinHeader disableSwitch />);
    fireEvent.press(getByText('wallet'));
    expect(mockToastWarning).toHaveBeenCalledTimes(1);
    expect(mockToastWarning).toHaveBeenCalledWith(
      'page.memeCoin.addressSwitchUnsupported',
    );
    expect(mockToggleSceneVisible).not.toHaveBeenCalled();
    expect(mockPreFetchData).not.toHaveBeenCalled();
  });

  it('opens the switcher without a warning where switching is allowed', () => {
    const { getByText } = render(<MemeCoinHeader />);
    fireEvent.press(getByText('wallet'));
    expect(mockToggleSceneVisible).toHaveBeenCalledWith(
      'MakeTransactionAbout',
      true,
    );
    expect(mockToastWarning).not.toHaveBeenCalled();
  });
});

describe('HeaderAccountSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stays inert when disabled without a handler', () => {
    const { getByText } = render(
      <HeaderAccountSwitcher forScene="MakeTransactionAbout" disableSwitch />,
    );
    fireEvent.press(getByText('wallet'));
    expect(mockToggleSceneVisible).not.toHaveBeenCalled();
    expect(mockToastWarning).not.toHaveBeenCalled();
  });
});
