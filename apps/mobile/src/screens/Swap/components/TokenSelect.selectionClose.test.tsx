import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { TouchableOpacity } from 'react-native';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import TokenSelect from './TokenSelect';
import { SendAmountInput } from '@/screens/Send/components/SendAmountInput';

let mockSheetProps: any;
let mockSelectTokensInput: any;
let mockEvents: string[] = [];
const mockFocus = jest.fn(() => mockEvents.push('focus'));
const mockSetVisible = jest.fn();
const mockEmpty = jest.fn();
const mockFocusCleanups = new Set<() => void>();
let mockNavigationFocused = true;
const mockNavigation = { isFocused: () => mockNavigationFocused };

jest.mock('@/components/Token', () => ({
  TokenSelectorSheetModal: (props: any) => {
    mockSheetProps = props;
    // Match the real child cleanup: blur -> destroy() -> synchronous onDismiss
    // -> onClosed. React registers this child's effect before TokenSelect's.
    const ReactMock = require('react');
    require('@react-navigation/native').useFocusEffect(
      ReactMock.useCallback(
        () => () => {
          mockEvents.push('destroy', 'dismiss');
          props.onClosed?.();
        },
        [props.onClosed],
      ),
    );
    return null;
  },
}));
jest.mock('@/components/Token/TokenSelectorSheetModal', () => ({
  useTokenSelectorModalVisible: ({ onVisibleChanged }: any) => {
    const ReactMock = require('react');
    const visibleRef = ReactMock.useRef(false);
    const tokenSelectorModalRef = ReactMock.useRef(null);
    const optionsRef = ReactMock.useRef(onVisibleChanged);
    optionsRef.current = onVisibleChanged;
    const setTokenSelectorVisible = ReactMock.useCallback(
      (visible: boolean) => {
        mockEvents.push(visible ? 'open' : 'close-request');
        mockSetVisible(visible);
        optionsRef.current(visible);
        visibleRef.current = visible;
      },
      [],
    );
    return {
      visible: visibleRef.current,
      visibleRef,
      tokenSelectorModalRef,
      setTokenSelectorVisible,
    };
  },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: (callback: () => void | (() => void)) => {
    require('react').useEffect(() => {
      const cleanup = callback();
      if (cleanup) {
        mockFocusCleanups.add(cleanup);
      }
      return () => {
        if (cleanup) {
          mockFocusCleanups.delete(cleanup);
          cleanup();
        }
      };
    }, [callback]);
  },
}));
jest.mock('@/screens/Swap/hooks', () => ({
  useLongPressTokenAtom: () => [null, mockEmpty],
}));
jest.mock('@/screens/Swap/hooks/useSelectTokens', () => ({
  useSelectTokens: (input: any) => {
    mockSelectTokensInput = input;
    return {
      tokens: [],
      tokenRows: [],
      checkIsExpireAndUpdate: mockEmpty,
      ensureInitialTokenLoad: mockEmpty,
      loadToken: mockEmpty,
      loadOnVisibleChanged: mockEmpty,
      isLoading: false,
      isSearching: false,
    };
  },
}));
jest.mock('@/utils/token', () => ({
  getTokenSymbol: (token: any) => token.symbol,
}));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('@/assets/icons/swap', () => ({ RcIconSwapBottomArrow: () => null }));
jest.mock('@/assets/icons/send/switch-amount', () => ({
  RcIconAmountModeSwitch: () => null,
}));
jest.mock('@/assets2024/icons/swap/wallet-cc.svg', () => () => null);
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const colors = new Proxy({}, { get: () => '#000000' });
    return {
      styles: getStyle.getStyles({ colors, colors2024: colors, isLight: true }),
      colors2024: colors,
    };
  },
}));
jest.mock('@/components', () => ({ AssetAvatar: () => null }));
jest.mock('@/utils/text', () => ({
  ellipsisOverflowedText: (text: string) => text,
}));
jest.mock('@/store/customTestnet', () => ({
  useCustomTestnetStore: (selector: any) => selector({ customTestnet: {} }),
}));
jest.mock('@/hooks/accountsSwitcher', () => ({
  useScreenSceneAccountContext: () => ({}),
}));
jest.mock('@/constant/layout', () => ({ RootNames: {} }));
jest.mock('@/utils/account', () => ({ isWatchOrSafeAccount: () => false }));
jest.mock('@/components2024/PillsSwitch/NetSwitchTabs', () => ({
  useSwitchNetTab: () => ({
    isShowTestnet: false,
    selectedTab: 'mainnet',
    onTabChange: mockEmpty,
  }),
}));
jest.mock('@/hooks/chainAndToken/useSearchTestnetToken', () => ({
  useSearchTestnetToken: () => ({ testnetTokenList: [], loading: false }),
}));
jest.mock('@/hooks/useTokenSettings', () => ({
  useUserTokenSettings: () => ({
    userTokenSettings: { pinedQueue: [] },
    fetchUserTokenSettings: mockEmpty,
  }),
}));
jest.mock('@/screens/Home/utils/token', () => ({
  tagTokenItemFavorite: (token: any) => token,
}));
jest.mock('@/components/Token/hooks/favorite', () => ({
  useFavoriteTokens: () => ({ data: [], loading: false }),
}));
jest.mock('@/components/Token/hooks/favoriteResource', () => ({
  resolveFavoriteTokenOwnerAddress: () => undefined,
}));
jest.mock('@/utils/isSameAccount', () => ({
  isSameAccount: (a: any, b: any) => a === b,
}));
jest.mock('@/devtools/regressionScenarios/react', () => ({
  useRegressionScenarioComponentAction: () => undefined,
}));
jest.mock('react-native-haptic-feedback', () => ({
  trigger: () => mockEmpty(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/core/native/utils', () => ({ IS_ANDROID: true }));
jest.mock('@/components/AutoShrinkAmountTextSizing', () => ({
  DEFAULT_MAX_FONT_SIZE: 36,
}));
jest.mock('@/components/Touchable/TouchableView', () => ({
  SilentTouchableView: require('react-native').View,
}));
jest.mock('@/components2024/CustomSkeleton', () => ({
  CustomSkeleton: () => null,
}));
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('@/components/Typography', () => {
  const ReactMock = require('react');
  const { Text, View } = require('react-native');
  return {
    Text,
    TextInput: ReactMock.forwardRef((props: any, ref: any) => {
      ReactMock.useImperativeHandle(ref, () => ({
        focus: mockFocus,
        setNativeProps: mockEmpty,
      }));
      return <View {...props} />;
    }),
  };
});

const token = {
  id: 'eth',
  chain: 'eth',
  symbol: 'ETH',
  amount: 1,
} as TokenItem;

describe('token selection native close completion', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNavigationFocused = true;
    mockEvents = [];
    mockFocus.mockClear();
    mockSetVisible.mockClear();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('updates Send, starts closing, then focuses exactly once after native completion', () => {
    render(
      <SendAmountInput
        token={token}
        unit="ETH"
        quoteText=""
        canSwitchMode={false}
        onTokenChange={() => mockEvents.push('selected')}
      />,
    );
    act(() => mockSheetProps.onConfirm(token));
    expect(mockEvents).toEqual(['selected', 'close-request']);
    expect(mockFocus).not.toHaveBeenCalled();
    act(() => mockSheetProps.onClosed?.());
    expect(mockEvents).toEqual(['selected', 'close-request', 'focus']);
    act(() => mockSheetProps.onClosed?.());
    expect(mockFocus).toHaveBeenCalledTimes(1);
  });

  it('does not focus on a generic dismissal without a selection', () => {
    const onClosed = jest.fn();
    render(
      <TokenSelect
        chainId=""
        onTokenChange={mockEmpty}
        onTokenSelectionClosed={onClosed}
      />,
    );
    act(() => mockSheetProps.onClosed?.());
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('does not focus when child blur cleanup synchronously dismisses before parent cleanup', () => {
    render(
      <SendAmountInput
        token={token}
        unit="ETH"
        quoteText=""
        canSwitchMode={false}
        onTokenChange={() => mockEvents.push('selected')}
      />,
    );
    act(() => mockSheetProps.onConfirm(token));
    act(() => {
      // Navigation updates its current route before emitting blur listeners.
      mockNavigationFocused = false;
      mockEvents.push('blur');
      mockFocusCleanups.forEach(cleanup => cleanup());
    });
    expect(mockEvents).toEqual([
      'selected',
      'close-request',
      'blur',
      'destroy',
      'dismiss',
    ]);
    expect(mockFocus).not.toHaveBeenCalled();
    mockNavigationFocused = true;
    act(() => mockSheetProps.onClosed?.());
    expect(mockFocus).not.toHaveBeenCalled();
  });

  it('cancels the pending callback when the picker reopens', () => {
    const onClosed = jest.fn();
    const view = render(
      <TokenSelect
        chainId=""
        onTokenChange={mockEmpty}
        onTokenSelectionClosed={onClosed}
      />,
    );
    act(() => mockSheetProps.onConfirm(token));
    fireEvent.press(view.UNSAFE_getByType(TouchableOpacity));
    act(() => mockSheetProps.onClosed?.());
    expect(onClosed).not.toHaveBeenCalled();
  });

  it.each(['unmount', 'blur', 'type', 'chain', 'account'] as const)(
    'cancels the pending callback on %s',
    change => {
      const onClosed = jest.fn();
      const props = {
        chainId: '',
        onTokenChange: mockEmpty,
        onTokenSelectionClosed: onClosed,
      };
      const view = render(<TokenSelect {...props} />);
      act(() => mockSheetProps.onConfirm(token));
      const staleNativeClosed = mockSheetProps.onClosed;
      if (change === 'unmount') {
        view.unmount();
      } else if (change === 'blur') {
        mockNavigationFocused = false;
        act(() => mockFocusCleanups.forEach(cleanup => cleanup()));
      } else {
        view.rerender(
          <TokenSelect
            {...props}
            type={change === 'type' ? 'swapFrom' : 'send'}
            chainId={change === 'chain' ? 'arb' : ''}
            accountInScreen={
              change === 'account'
                ? ({ address: '0x123', type: 'test' } as any)
                : undefined
            }
          />,
        );
      }
      act(() => staleNativeClosed?.());
      expect(onClosed).not.toHaveBeenCalled();
    },
  );

  it('preserves immediate Swap token selection without opting into post-close work', () => {
    const onTokenChange = jest.fn();
    render(
      <TokenSelect chainId="" type="swapFrom" onTokenChange={onTokenChange} />,
    );
    act(() => mockSheetProps.onConfirm(token));
    expect(onTokenChange).toHaveBeenCalledWith(token);
    expect(mockSetVisible).toHaveBeenCalledWith(false);
    expect(mockFocus).not.toHaveBeenCalled();
  });

  it.each(['send', 'swapFrom', 'swapTo', 'bridgeFrom', 'bridgeTo'] as const)(
    'opens %s with a fresh search after viewing a token detail',
    async type => {
      const view = render(
        <TokenSelect chainId="eth" type={type} onTokenChange={mockEmpty} />,
      );
      await act(async () => {
        await mockSheetProps.onSearch('eth');
      });
      act(() => jest.advanceTimersByTime(250));
      expect(mockSelectTokensInput.keyword).toBe('eth');
      // A detail route destroys the child sheet, but leaves this screen mounted.
      mockNavigationFocused = false;
      act(() => mockFocusCleanups.forEach(cleanup => cleanup()));
      mockNavigationFocused = true;
      fireEvent.press(view.UNSAFE_getByType(TouchableOpacity));
      expect(mockSelectTokensInput.keyword).toBe('');
      expect(mockSelectTokensInput.chain_server_id).toBe('eth');
    },
  );
});
