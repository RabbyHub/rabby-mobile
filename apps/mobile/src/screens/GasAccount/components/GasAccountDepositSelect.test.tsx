import React from 'react';
import { render } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';
import { GasAccountDepositSelect } from './GasAccountDepositSelect';

const mockCheckIsExpireAndUpdate = jest.fn(() => Promise.resolve());
const mockRefreshBridgeSupportTokenList = jest.fn(() => Promise.resolve());

jest.mock('@/screens/GasAccount/hooks/useDepositTokenAvailability', () => ({
  useGasAccountDepositAvailableTokens: () => ({
    tokenDisabled: true,
    checkIsExpireAndUpdate: mockCheckIsExpireAndUpdate,
    refreshBridgeSupportTokenList: mockRefreshBridgeSupportTokenList,
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => {
  const colors = new Proxy({}, { get: (_, key) => String(key) });
  return {
    useTheme2024: ({ getStyle }: any) => ({
      styles: getStyle.getStyles({
        classicalColors: colors,
        colors,
        colors2024: colors,
        isLight: true,
        safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
      isLight: true,
    }),
  };
});
jest.mock('@/components', () => ({
  Tip: ({ children }: any) => children,
}));
jest.mock('@/components2024/Button', () => ({
  Button: ({ title }: any) => title,
}));
jest.mock('@/assets2024/icons/gas-account', () => ({
  RcIconApple: () => null,
  RcIconGooglePayCC: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('GasAccountDepositSelect', () => {
  it('refreshes token balances and support list on open', () => {
    const runAfterInteractions = jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((task: any) => {
        task();
        return { cancel: jest.fn() } as any;
      });

    render(<GasAccountDepositSelect onSelect={jest.fn()} />);

    expect(mockCheckIsExpireAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockRefreshBridgeSupportTokenList).toHaveBeenCalledTimes(1);
    runAfterInteractions.mockRestore();
  });
});
