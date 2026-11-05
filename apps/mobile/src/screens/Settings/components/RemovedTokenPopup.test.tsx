import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import LinearGradient from 'react-native-linear-gradient';

const removedToken = {
  chainId: 'eth',
  tokenId: '0x0000000000000000000000000000000000000001',
};

jest.mock('react-native-linear-gradient', () => {
  const ReactModule = require('react');
  const { View: RNView } = require('react-native');
  return {
    __esModule: true,
    default: (props: object) => ReactModule.createElement(RNView, props),
  };
});
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View: RNView } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          present: jest.fn(),
          dismiss: jest.fn(),
        }));
        return ReactModule.createElement(RNView, props);
      },
    ),
  };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { View: RNView } = require('react-native');
  return {
    BottomSheetFlatList: ({
      data,
      renderItem,
      ListHeaderComponent,
      ItemSeparatorComponent,
      ...rest
    }: any) =>
      ReactModule.createElement(
        RNView,
        rest,
        ListHeaderComponent,
        data.map((item: unknown, index: number) =>
          ReactModule.createElement(
            ReactModule.Fragment,
            { key: index },
            renderItem({ item, index }),
            index < data.length - 1 && ItemSeparatorComponent
              ? ReactModule.createElement(ItemSeparatorComponent)
              : null,
          ),
        ),
      ),
  };
});
jest.mock('@/components/AssetAvatar', () => ({
  AssetAvatar: () => null,
}));
jest.mock('@/components2024/CustomSkeleton', () => ({
  CustomSkeleton: () => null,
}));
jest.mock('@/components/AutoLockView', () => ({
  useRefreshAutoLockPanResponder: () => ({ panResponder: { panHandlers: {} } }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/hooks/useRemovedTokens', () => ({
  useRemovedTokens: (selector: (state: object) => unknown) =>
    selector({ removedTokens: [removedToken] }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const colors2024 = new Proxy({}, { get: () => '#ffffff' });
    return {
      colors2024,
      isLight: true,
      styles: getStyle({ colors2024, isLight: true }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/core/serviceApi/preference', () => ({
  getFallbackAccountSnapshot: () => ({ address: '0xowner' }),
}));
jest.mock('@/core/request', () => ({
  openapi: {
    customListToken: jest.fn(async () => [
      {
        chain: 'eth',
        id: removedToken.tokenId,
        symbol: 'USDC',
        logo_url: '',
      },
    ]),
  },
}));
jest.mock('@/utils/navigation', () => ({
  navigateDeprecated: jest.fn(),
}));
jest.mock('@/utils/token', () => ({
  getTokenSymbol: (token: { symbol?: string }) => token.symbol || '',
  tokenItemToITokenItem: (token: unknown) => token,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

import { RemovedTokenPopup } from './RemovedTokenPopup';

it('keeps the card frame and gradient background as separate views', async () => {
  render(<RemovedTokenPopup onClose={jest.fn()} />);

  await waitFor(() => expect(screen.getByText('USDC')).toBeVisible());

  const views = screen.UNSAFE_getAllByType(View);
  const card = views.find(
    view => StyleSheet.flatten(view.props.style)?.height === 68,
  );
  expect(card).toBeDefined();
  expect(StyleSheet.flatten(card!.props.style)).toMatchObject({
    overflow: 'hidden',
    height: 68,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
  });

  const gradient = screen.UNSAFE_getByType(LinearGradient);
  expect(StyleSheet.flatten(gradient.props.style)).toMatchObject({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });
  expect(gradient.props.pointerEvents).toBe('none');
});
