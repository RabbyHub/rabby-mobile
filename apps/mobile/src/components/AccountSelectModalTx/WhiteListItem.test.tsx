import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';

import type { KeyringAccountWithAlias } from '@/hooks/account';

import { WhiteListItemInSheetModal } from './WhiteListItem';

type MockContextMenuProps = {
  menuConfig: {
    menuActions: Array<{ key: string }>;
    menuTitle?: string;
  };
  preViewBorderRadius?: number;
  triggerProps?: {
    action?: string;
  };
};

let mockCardStyle: ViewStyle | undefined;
let mockContextMenuProps: MockContextMenuProps | undefined;
let mockShadowStyle: ViewStyle | undefined;
let mockIsAndroid = false;
let mockIsIos = true;

jest.mock('@/components2024/ContextMenuView/ContextMenuView', () => ({
  ContextMenuView: ({ children, ...props }: any) => {
    mockContextMenuProps = props;
    return children;
  },
}));

jest.mock('@/components2024/AddressItem/AddressItem', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ height, style, width }: any) => (
    <View style={[style, { height, width }]} />
  );

  return {
    AddressItem: ({ children }: any) =>
      children({ WalletBalance: MockIcon, WalletIcon: MockIcon }),
  };
});

jest.mock('@/components2024/Card', () => {
  const React = require('react');
  const { StyleSheet, View } = require('react-native');

  return {
    Card: ({ children, style, ...props }: any) => {
      mockCardStyle = StyleSheet.flatten(style);
      return (
        <View style={style} {...props}>
          {children}
        </View>
      );
    },
  };
});

jest.mock('@/screens/Address/components/AddressItemShadowView', () => {
  const React = require('react');
  const { StyleSheet: RNStyleSheet, View } = require('react-native');

  return {
    AddressItemShadowView: ({ children, style, ...props }: any) => {
      mockShadowStyle = RNStyleSheet.flatten(style);
      return (
        <View style={style} {...props}>
          {children}
        </View>
      );
    },
  };
});

jest.mock('@/hooks/theme', () => {
  const colors = new Proxy({}, { get: (_, key) => String(key) });
  const styleContext = {
    classicalColors: colors,
    colors,
    colors2024: colors,
    isLight: true,
    safeAreaInsets: { bottom: 0, left: 0, right: 0, top: 0 },
  };

  return {
    useGetBinaryMode: () => 'light',
    useTheme2024: ({ getStyle }: any = {}) => ({
      colors2024: colors,
      styles: getStyle?.getStyles?.(styleContext) ?? {},
    }),
  };
});

jest.mock('@/hooks/whitelist', () => ({
  useWhitelist: () => ({ removeWhitelist: jest.fn() }),
}));

jest.mock('@/components2024/AliasNameEditModal/useAliasNameEditModal', () => ({
  useAliasNameEditModal: () => ({ show: jest.fn() }),
}));

jest.mock('@/databases/hooks/cex', () => ({
  getCexWithLocalCache: () => new Promise(() => undefined),
}));

jest.mock('@/core/native/utils', () => ({
  get IS_ANDROID() {
    return mockIsAndroid;
  },
  get IS_IOS() {
    return mockIsIos;
  },
}));

jest.mock('@/components/Typography', () => {
  const { Text } = require('react-native');
  return { Text };
});

jest.mock('@/assets/icons/send', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockIcon = (props: any) => <View {...props} />;

  return {
    RcIconLockCC: MockIcon,
    RcIconSwitchCC: MockIcon,
  };
});

jest.mock('@/utils/address', () => ({
  ellipsisAddress: (address: string) => address,
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('@/components/AddressViewer/CopyAddress', () => ({
  toastCopyAddressSuccess: jest.fn(),
}));

jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: jest.fn(),
  removeGlobalBottomSheetModal2024: jest.fn(),
}));

jest.mock('@/components2024/GlobalBottomSheetModal/types', () => ({
  MODAL_NAMES: { CONFIRM_ADDRESS: 'CONFIRM_ADDRESS' },
}));

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const account = {
  address: '0x1111111111111111111111111111111111111111',
  aliasName: 'Test address',
  brandName: 'test',
  type: 'test',
} as KeyringAccountWithAlias;

describe('WhiteListItemInSheetModal long-press boundary', () => {
  beforeEach(() => {
    mockCardStyle = undefined;
    mockContextMenuProps = undefined;
    mockShadowStyle = undefined;
    mockIsAndroid = false;
    mockIsIos = true;
  });

  it('keeps the iOS border and pressed fill on the same touchable surface', () => {
    const view = render(
      <WhiteListItemInSheetModal
        account={account}
        enableMenu
        hideBalance
        inWhiteList
      />,
    );

    const touchable = view.UNSAFE_getByType(TouchableOpacity);

    expect(StyleSheet.flatten(touchable.props.style)).toEqual(
      expect.objectContaining({
        borderColor: 'neutral-line',
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
      }),
    );
    expect(mockShadowStyle).toEqual(
      expect.objectContaining({
        backgroundColor: 'neutral-bg-1',
        borderWidth: 0,
      }),
    );
    expect(mockCardStyle).toEqual(
      expect.objectContaining({
        backgroundColor: 'transparent',
        borderRadius: 20,
      }),
    );

    fireEvent(touchable, 'pressIn');

    const pressedTouchable = view.UNSAFE_getByType(TouchableOpacity);
    expect(StyleSheet.flatten(pressedTouchable.props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: 'brand-light-1',
        borderColor: 'neutral-line',
        borderWidth: 1,
      }),
    );
    expect(mockCardStyle).toEqual(
      expect.objectContaining({
        backgroundColor: 'transparent',
      }),
    );

    fireEvent(pressedTouchable, 'pressOut');

    expect(
      StyleSheet.flatten(view.UNSAFE_getByType(TouchableOpacity).props.style),
    ).not.toHaveProperty('backgroundColor');
  });

  it('keeps the iOS preview shape and whitelist menu behavior', () => {
    render(
      <WhiteListItemInSheetModal
        account={account}
        enableMenu
        hideBalance
        inWhiteList
      />,
    );

    expect(mockContextMenuProps).toEqual(
      expect.objectContaining({
        preViewBorderRadius: 20,
        triggerProps: { action: 'longPress' },
      }),
    );
    expect(
      mockContextMenuProps?.menuConfig.menuActions.map(action => action.key),
    ).toEqual(['copy', 'edit', 'remove']);
  });

  it('preserves the Android border and pressed-card ownership', () => {
    mockIsAndroid = true;
    mockIsIos = false;

    const view = render(
      <WhiteListItemInSheetModal
        account={account}
        enableMenu
        hideBalance
        inWhiteList
      />,
    );

    const touchable = view.UNSAFE_getByType(TouchableOpacity);
    const touchableStyle = StyleSheet.flatten(touchable.props.style);

    expect(touchable.props.delayLongPress).toBe(350);
    expect(touchableStyle).toEqual(
      expect.objectContaining({
        borderRadius: 20,
        overflow: 'hidden',
      }),
    );
    expect(touchableStyle).not.toHaveProperty('borderWidth');
    expect(mockShadowStyle).not.toHaveProperty('borderWidth');
    expect(mockCardStyle).toEqual(
      expect.objectContaining({
        backgroundColor: 'neutral-bg-1',
      }),
    );

    fireEvent(touchable, 'pressIn');

    expect(mockCardStyle).toEqual(
      expect.objectContaining({
        backgroundColor: 'brand-light-1',
        borderRadius: 20,
      }),
    );
    expect(
      StyleSheet.flatten(view.UNSAFE_getByType(TouchableOpacity).props.style),
    ).not.toHaveProperty('backgroundColor');
  });

  it('keeps the iOS no-menu press feedback on the visible border', () => {
    const view = render(
      <WhiteListItemInSheetModal account={account} hideBalance inWhiteList />,
    );

    const touchable = view.UNSAFE_getByType(TouchableOpacity);
    fireEvent(touchable, 'pressIn');

    const pressedStyle = StyleSheet.flatten(
      view.UNSAFE_getByType(TouchableOpacity).props.style,
    );
    expect(pressedStyle).toEqual(
      expect.objectContaining({
        borderColor: 'brand-light-2',
        borderWidth: 1,
      }),
    );
    expect(pressedStyle).not.toHaveProperty('backgroundColor');
    expect(mockContextMenuProps).toBeUndefined();
  });
});
