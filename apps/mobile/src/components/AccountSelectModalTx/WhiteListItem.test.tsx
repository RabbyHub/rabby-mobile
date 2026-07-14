import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { TouchableOpacity, type ViewStyle } from 'react-native';

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

let mockHandleStyle: ViewStyle | undefined;
let mockHandleTouchableStyle: ViewStyle | undefined;
let mockHandleTouchesDown: (() => void) | undefined;
let mockHandleTouchesUp: (() => void) | undefined;
let mockHandleTouchesCancelled: (() => void) | undefined;
let mockContextMenuProps: MockContextMenuProps | undefined;
let mockDragIconProps: { height?: number; width?: number } | undefined;
let mockCardStyle: ViewStyle | undefined;

jest.mock('react-native-sortables', () => {
  const React = require('react');
  const { StyleSheet, View } = require('react-native');

  return {
    __esModule: true,
    default: {
      Handle: ({ children, style }: any) => {
        mockHandleStyle = StyleSheet.flatten(style);
        return <View testID="sortable-handle">{children}</View>;
      },
    },
    useItemContext: () => ({ gesture: {} }),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { StyleSheet } = require('react-native');

  const createManualGesture = () => {
    const gesture = {
      simultaneousWithExternalGesture: jest.fn(() => gesture),
      runOnJS: jest.fn(() => gesture),
      onTouchesDown: jest.fn((callback: () => void) => {
        mockHandleTouchesDown = callback;
        return gesture;
      }),
      onTouchesUp: jest.fn((callback: () => void) => {
        mockHandleTouchesUp = callback;
        return gesture;
      }),
      onTouchesCancelled: jest.fn((callback: () => void) => {
        mockHandleTouchesCancelled = callback;
        return gesture;
      }),
    };
    return gesture;
  };

  return {
    Gesture: {
      Manual: createManualGesture,
    },
    GestureDetector: ({ children }: any) => {
      mockHandleTouchableStyle = StyleSheet.flatten(children.props.style);
      return <>{children}</>;
    },
  };
});

jest.mock('@/components2024/ContextMenuView/ContextMenuView', () => {
  return {
    ContextMenuView: ({ children, ...props }: any) => {
      mockContextMenuProps = props;
      return children;
    },
  };
});

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
  const { View } = require('react-native');

  return {
    AddressItemShadowView: ({ children, ...props }: any) => (
      <View {...props}>{children}</View>
    ),
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
  IS_ANDROID: false,
}));

jest.mock('@/components/Typography', () => {
  const { Text } = require('react-native');
  return { Text };
});

jest.mock('@/assets/icons/send', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { RcIconLockCC: (props: any) => <View {...props} /> };
});

jest.mock('@/assets2024/icons/whitelist/drag-handle.svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) => {
    mockDragIconProps = props;
    return <View testID="drag-handle-icon" />;
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

describe('WhiteListItemInSheetModal sortable interactions', () => {
  beforeEach(() => {
    mockHandleStyle = undefined;
    mockHandleTouchableStyle = undefined;
    mockHandleTouchesDown = undefined;
    mockHandleTouchesUp = undefined;
    mockHandleTouchesCancelled = undefined;
    mockContextMenuProps = undefined;
    mockDragIconProps = undefined;
    mockCardStyle = undefined;
  });

  it('keeps the original long-press menu and confines dragging to the right handle', () => {
    render(
      <WhiteListItemInSheetModal
        account={account}
        enableMenu
        hideBalance
        inWhiteList
        sortable
      />,
    );

    expect(mockHandleStyle).toEqual(
      expect.objectContaining({
        alignItems: 'center',
        height: 78,
        justifyContent: 'center',
        position: 'absolute',
        right: 0,
        top: 0,
        width: 60,
        zIndex: 1,
      }),
    );
    expect(mockDragIconProps).toEqual(
      expect.objectContaining({ height: 20, width: 20 }),
    );
    expect(mockHandleTouchableStyle).toEqual(
      expect.objectContaining({
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        width: '100%',
      }),
    );
    expect(mockContextMenuProps).toEqual(
      expect.objectContaining({
        preViewBorderRadius: 16,
        triggerProps: { action: 'longPress' },
      }),
    );
    expect(
      mockContextMenuProps?.menuConfig.menuActions.map(action => action.key),
    ).toEqual(['copy', 'edit', 'remove']);
  });

  it('keeps address selection on the original pressable item', () => {
    const onPress = jest.fn();
    const view = render(
      <WhiteListItemInSheetModal
        account={account}
        enableMenu
        hideBalance
        inWhiteList
        sortable
        onPress={onPress}
      />,
    );

    fireEvent.press(view.UNSAFE_getByType(TouchableOpacity));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the selected background while the drag handle is held and while dragging', () => {
    const view = render(
      <WhiteListItemInSheetModal
        account={account}
        enableMenu
        hideBalance
        inWhiteList
        sortable
      />,
    );

    expect(mockCardStyle?.backgroundColor).toBe('neutral-bg-1');

    act(() => mockHandleTouchesDown?.());
    expect(mockCardStyle?.backgroundColor).toBe('brand-light-1');

    act(() => mockHandleTouchesUp?.());
    expect(mockCardStyle?.backgroundColor).toBe('neutral-bg-1');

    view.rerender(
      <WhiteListItemInSheetModal
        account={account}
        enableMenu
        hideBalance
        inWhiteList
        interactionDisabled
        isActiveDragging
        sortable
      />,
    );
    expect(mockCardStyle?.backgroundColor).toBe('brand-light-1');
  });

  it('clears the selected background when the drag handle touch is cancelled', () => {
    render(
      <WhiteListItemInSheetModal
        account={account}
        enableMenu
        hideBalance
        inWhiteList
        sortable
      />,
    );

    act(() => mockHandleTouchesDown?.());
    expect(mockCardStyle?.backgroundColor).toBe('brand-light-1');

    act(() => mockHandleTouchesCancelled?.());
    expect(mockCardStyle?.backgroundColor).toBe('neutral-bg-1');
  });
});
