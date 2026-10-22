import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { FlatListProps, ListRenderItemInfo } from 'react-native';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import type { ITokenItem } from '@/store/tokens';
import { ASSETS_ITEM_HEIGHT_NEW, RootNames } from '@/constant/layout';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { navigateDeprecated } from '@/utils/navigation';
import TokenGroupDetailSheet from './TokenGroupDetailSheet';

const mockListRender = jest.fn();
const mockFindAccount = jest.fn();

// Component-unit boundary: exercise this sheet's list metrics, ordering and
// selection contract, not native FlatList measurement or opening performance.
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetFlatList: function MockBottomSheetFlatList(
    props: FlatListProps<ITokenItem>,
  ) {
    const { View } = require('react-native');
    mockListRender(props);
    return (
      <View>
        {props.data?.map((item, index) => (
          <View
            key={props.keyExtractor?.(item, index)}
            testID={`group-cell-${index}`}>
            {props.renderItem?.({
              item,
              index,
              separators: {
                highlight: jest.fn(),
                unhighlight: jest.fn(),
                updateProps: jest.fn(),
              },
            })}
          </View>
        ))}
      </View>
    );
  },
}));
jest.mock('@/hooks/theme', () => {
  const colors = new Proxy({}, { get: () => '#123456' });
  return {
    useTheme2024: ({ getStyle }: any) => ({
      styles: getStyle({ colors2024: colors, isLight: false }),
    }),
  };
});
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('./hooks/share', () => ({
  useFindAccountByAddress: () => mockFindAccount,
}));
jest.mock('@/screens/Home/components/AssetRenderItems', () => ({
  TokenRowV2: function MockTokenRow({ data, onTokenPress, style }: any) {
    const { Text, TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity style={style} onPress={() => onTokenPress(data)}>
        <Text>{data.symbol}</Text>
      </TouchableOpacity>
    );
  },
}));
jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@/components/AssetAvatar', () => ({ AssetAvatar: () => null }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/screens/Home/components/AccountOverview', () => ({
  AccountOverview: () => null,
}));
jest.mock('@/utils/token', () => ({
  getTokenSymbol: (token: ITokenItem) => token.symbol,
}));
jest.mock('@/utils/number', () => ({
  formatAmount: (amount: number) => String(amount),
  formatNumber: (amount: string | number) => String(amount),
}));
jest.mock('@/utils/navigation', () => ({ navigateDeprecated: jest.fn() }));

const accounts = ['0x111', '0x222', '0x333'].map(
  address => ({ address, aliasName: address } as KeyringAccountWithAlias),
);
const tokens = accounts.map(
  (account, index) =>
    ({
      id: 'usdc',
      chain: 'arb',
      symbol: 'USDC',
      owner_addr: account.address,
      is_core: index !== 0,
      price: 1,
      amount: [1000, 2, 20][index],
    } as ITokenItem),
);

const baseProps: React.ComponentProps<typeof TokenGroupDetailSheet> = {
  name: MODAL_NAMES.TOKEN_GROUP_DETAIL,
  $createParams: { name: MODAL_NAMES.TOKEN_GROUP_DETAIL },
  tokens,
};

function getListProps(): FlatListProps<ITokenItem> {
  return mockListRender.mock.calls[mockListRender.mock.calls.length - 1][0];
}

function renderRow(props: FlatListProps<ITokenItem>, index: number) {
  return props.renderItem!({
    item: props.data![index],
    index,
    separators: {
      highlight: jest.fn(),
      unhighlight: jest.fn(),
      updateProps: jest.fn(),
    },
  } satisfies ListRenderItemInfo<ITokenItem>)!;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFindAccount.mockImplementation(address =>
    accounts.find(account => account.address === address),
  );
});

describe.each([
  { label: 'price', amountOnly: false, isCustomTestnetToken: false },
  { label: 'amount-only', amountOnly: true, isCustomTestnetToken: true },
])('TokenGroupDetailSheet $label rows', mode => {
  it('includes row margins and the leading padding exactly once in fixed metrics', () => {
    render(<TokenGroupDetailSheet {...baseProps} {...mode} />);
    const props = getListProps();
    const content = StyleSheet.flatten(props.contentContainerStyle);
    expect(content).toMatchObject({
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 24,
    });

    props.data!.forEach((_token, index) => {
      const row = renderRow(props, index);
      const style = StyleSheet.flatten(row.props.style);
      expect(style).toMatchObject({
        height: ASSETS_ITEM_HEIGHT_NEW,
        marginBottom: 8,
      });
      const extent = style.height + style.marginBottom;
      expect(props.getItemLayout!(props.data, index)).toEqual({
        length: extent,
        offset: content.paddingTop! + extent * index,
        index,
      });
    });

    expect(props.getItemLayout!(props.data, 0)).toEqual({
      length: 78,
      offset: 12,
      index: 0,
    });
    // Bottom padding is outside the last cell, not part of its length/offset.
    expect(props.getItemLayout!(props.data, 2)).toEqual({
      length: 78,
      offset: 168,
      index: 2,
    });
  });

  it('preserves core/value ordering and distinct owner keys without mutating input', () => {
    render(<TokenGroupDetailSheet {...baseProps} {...mode} />);
    const props = getListProps();
    expect(props.data).toEqual([tokens[2], tokens[1], tokens[0]]);
    expect(tokens.map(token => token.owner_addr)).toEqual(
      accounts.map(account => account.address),
    );
    expect(
      props.data!.map((token, index) => props.keyExtractor!(token, index)),
    ).toEqual(['0x333-arb-usdc-', '0x222-arb-usdc-', '0x111-arb-usdc-']);
  });

  it('opens the token and account belonging to the pressed sorted row', () => {
    const onCancel = jest.fn();
    const view = render(
      <TokenGroupDetailSheet {...baseProps} {...mode} onCancel={onCancel} />,
    );
    fireEvent.press(within(view.getByTestId('group-cell-0')).getByText('USDC'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(navigateDeprecated).toHaveBeenCalledWith(RootNames.TokenDetail, {
      token: tokens[2],
      account: accounts[2],
      unHold: false,
      needUseCacheToken: true,
      isCustomTestnetToken: mode.isCustomTestnetToken,
    });
    const navigation = jest.mocked(navigateDeprecated);
    expect(navigation.mock.calls[0][1]?.token).toBe(tokens[2]);
    expect(onCancel.mock.invocationCallOrder[0]).toBeLessThan(
      navigation.mock.invocationCallOrder[0],
    );
  });
});

it('keeps fixed metrics stable while reordered current data drives selection', () => {
  const view = render(<TokenGroupDetailSheet {...baseProps} />);
  const getLayout = getListProps().getItemLayout;
  const updatedToken = { ...tokens[1], amount: 200 };
  view.rerender(
    <TokenGroupDetailSheet
      {...baseProps}
      amountOnly
      tokens={[tokens[0], updatedToken, tokens[2]]}
    />,
  );
  expect(getListProps().getItemLayout).toBe(getLayout);
  fireEvent.press(within(view.getByTestId('group-cell-0')).getByText('USDC'));
  expect(jest.mocked(navigateDeprecated).mock.calls[0][1]).toMatchObject({
    token: updatedToken,
    account: accounts[1],
  });
});
