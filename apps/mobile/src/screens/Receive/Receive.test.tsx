import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { themeColorsNext2024 } from '@rabby-wallet/base-utils/src/isomorphic/theme-colors';
import { Button } from '@/components2024/Button';
import { createGlobalBottomSheetModal2024 } from '@/components2024/GlobalBottomSheetModal';
import ReceiveScreen from './Receive';

let mockIsLight = false;
const mockRoute = {
  params: {
    account: {
      address: '0x0000000000000000000000000000000000000001',
      aliasName: 'Test account',
      type: 'Simple Key Pair',
    },
  },
};

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const colors2024 =
      require('@rabby-wallet/base-utils/src/isomorphic/theme-colors')
        .themeColorsNext2024[mockIsLight ? 'light' : 'dark'];
    return {
      colors2024,
      styles: getStyle.getStyles({ colors2024, isLight: mockIsLight }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyles: unknown) => ({ getStyles }),
}));
jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockRoute,
  useIsFocused: () => true,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock(
  '@/components2024/ScreenContainer/FooterButtonScreenContainer',
  () => ({
    FooterButtonScreenContainer: require('react-native').View,
  }),
);
jest.mock('@/components2024/Button', () => {
  const { View, Text } = require('react-native');
  return {
    Button: (props: any) => (
      <View {...props} testID="receive-chain-button">
        {typeof props.title === 'string' ? (
          <Text>{props.title}</Text>
        ) : (
          props.title
        )}
      </View>
    ),
  };
});
jest.mock('@/components2024/Toast', () => ({ toast: { success: jest.fn() } }));
jest.mock('@/components2024/WalletIcon/WalletIcon', () => ({
  WalletIcon: () => null,
}));
jest.mock('@/components/CustomTouchableOpacity', () => ({
  CustomTouchableOpacity: require('react-native').View,
}));
jest.mock('@/components2024/FooterButtonGroup', () => ({
  FooterButtonGroup: () => null,
}));
jest.mock('@/components/AppStatusBar', () => ({
  useSafeSetNavigationOptions: () => ({ setNavigationOptions: jest.fn() }),
}));
jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: jest.fn(() => 'receive-chain-sheet'),
  removeGlobalBottomSheetModal2024: jest.fn(),
}));
jest.mock('@/hooks/gnosis/useGnosisNetworks', () => ({
  useGnosisNetworks: () => ({ data: undefined }),
}));
jest.mock('@/hooks/account', () => ({ useBackupReminder: () => false }));
jest.mock('@/components2024/BackupReminderCard', () => ({
  BackupReminderCard: () => null,
}));
jest.mock('@/screens/Home/components/OfflineChainNotify', () => ({
  OfflineChainNotify: () => null,
  useOfflineChain: () => ({}),
}));
jest.mock('@/components/RateModal/hooks', () => ({
  rateGuideLastExposureState: () => 0,
}));
jest.mock('@/components/Modal/TrackedModal', () => ({
  TrackedModal: () => null,
}));
jest.mock('@/devtools/regressionScenarios/react', () => ({
  useRegressionScenario: () => ({ active: false }),
}));
jest.mock('@/utils/navigation', () => ({ navigationRef: {} }));
jest.mock('@/utils/chain', () => ({
  findChainByEnum: () => ({
    name: 'Ethereum',
    logo: 'https://example.invalid/eth.png',
  }),
  findChainByID: jest.fn(),
}));
jest.mock('@/components/Chain/TestnetChainLogo', () => ({
  TestnetChainLogo: () => null,
}));
jest.mock('@/assets/icons/common', () => ({ RcArrowRightCC: () => null }));
jest.mock('react-native-qrcode-svg', () => () => null);
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

// Component/style contract only: native contrast and sheet gestures remain device checks.
describe('Receive chain selector contrast', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([true, false])(
    'keeps the chain button distinct from its card (light=%s)',
    isLight => {
      mockIsLight = isLight;
      const view = render(<ReceiveScreen />);
      const palette = themeColorsNext2024[isLight ? 'light' : 'dark'];
      const getButton = () => view.UNSAFE_getByType(Button);
      const cardBackground = StyleSheet.flatten(
        getButton().parent!.props.style,
      ).backgroundColor;
      expect(cardBackground).toBe(
        palette[isLight ? 'neutral-bg-1' : 'neutral-bg-2'],
      );
      const buttonBackground =
        palette[isLight ? 'neutral-bg-2' : 'neutral-bg-4'];
      expect(getButton().props.title).toBe('page.receive.allEVMChain');
      expect(
        StyleSheet.flatten(getButton().props.buttonStyle).backgroundColor,
      ).not.toBe(cardBackground);
      expect(
        StyleSheet.flatten(getButton().props.buttonStyle).backgroundColor,
      ).toBe(buttonBackground);

      fireEvent.press(view.getByTestId('receive-chain-button'));
      const onChange = jest.mocked(createGlobalBottomSheetModal2024).mock
        .calls[0][0].onChange;
      act(() => onChange('ETH'));
      expect(view.getByText('Ethereum')).toBeTruthy();
      expect(
        StyleSheet.flatten(getButton().props.buttonStyle).backgroundColor,
      ).not.toBe(cardBackground);
      expect(
        StyleSheet.flatten(getButton().props.buttonStyle).backgroundColor,
      ).toBe(buttonBackground);
    },
  );
});
