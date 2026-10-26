import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { TokenDetailHeaderArea } from './HeaderArea';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import type { ITokenItem } from '@/store/tokens';
jest.mock('@/assets2024/singleHome/copy-cc.svg', () => () => null);
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

// Isolate the navigation boundary, including its missing-provider contract.
jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  const NavigationContext = ReactModule.createContext(undefined);
  return {
    NavigationContext,
    useFocusEffect: (effect: () => void) => {
      if (!ReactModule.useContext(NavigationContext)) {
        throw new Error("Couldn't find a navigation object");
      }
      ReactModule.useEffect(effect, [effect]);
    },
  };
});
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/components', () => ({ AssetAvatar: () => null }));
jest.mock('@/components/CustomTouchableOpacity', () => ({
  CustomTouchableOpacity: require('react-native').TouchableOpacity,
}));
jest.mock('@/utils/token', () => ({ getTokenSymbol: () => 'TEST' }));
jest.mock('@/screens/Search/useAssets', () => ({
  useAssetsRefreshing: () => ({ refreshing: false }),
}));
jest.mock('@/components2024/RotateLoadingCircle', () => () => null);
jest.mock('@/components/AddressViewer/CopyAddress', () => ({
  toastCopyAddressSuccess: jest.fn(),
}));
jest.mock('@/utils/chain', () => ({
  findChain: () => ({ nativeTokenAddress: 'eth' }),
}));
jest.mock('@/utils/lpToken', () => ({ isLpToken: () => false }));
jest.mock('@/screens/Home/components/LpTokenIcon', () => () => null);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/utils/address', () => ({
  ellipsisAddress: () => 'contract-address',
}));
jest.mock('@/components/Modal/TrackedModal', () => ({
  TrackedModal: () => null,
}));
jest.mock('@/components2024/Button', () => ({ Button: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const token = {
  id: '0x0000000000000000000000000000000000000001',
  chain: 'eth',
} as ITokenItem;

it('renders the account-picker token row without any NavigationContainer', () => {
  render(<TokenDetailHeaderArea token={token} disableRefresh />);
  expect(screen.getByText('TEST')).toBeVisible();
});

it('still dismisses the contract copy confirmation when its screen blurs', () => {
  let onBlur: () => void = () => undefined;
  const unsubscribe = jest.fn();
  const navigation = {
    addListener: jest.fn((event: string, callback: () => void) => {
      expect(event).toBe('blur');
      onBlur = callback;
      return unsubscribe;
    }),
  } as unknown as React.ContextType<typeof NavigationContext>;
  const view = render(
    <NavigationContext.Provider value={navigation}>
      <TokenDetailHeaderArea token={token} showCopyIcon />
    </NavigationContext.Provider>,
  );
  fireEvent.press(screen.getByText('contract-address'));
  expect(screen.UNSAFE_getByType(TrackedModal).props.visible).toBe(true);
  act(() => onBlur());
  expect(screen.UNSAFE_getByType(TrackedModal).props.visible).toBe(false);
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
