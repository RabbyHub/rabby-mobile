import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AccountSelectPopup } from './index';

/**
 * The Safe submit sheet has no lightweight entry point (it needs a Safe account
 * and a queued transaction), so this exercises the native boundary with mocked
 * services: the account list, the sheet host, the gesture touchable and the
 * submit button.
 */
const accounts = [
  {
    address: '0x341a1f0000000000000000000000000000145479',
    aliasName: 'acct-1',
    type: 'SimpleKeyring',
    brandName: 'b1',
  },
  {
    address: '0x5853ed00000000000000000000000000006deb85',
    aliasName: 'acct-2',
    type: 'SimpleKeyring',
    brandName: 'b2',
  },
];

let lastListProps: any;

jest.mock('@/hooks/account', () => ({
  useAccounts: () => ({ accounts: require('./index.test').__mockAccounts }),
}));
jest.mock('@/hooks/theme', () => ({
  useThemeColors: () => new Proxy({}, { get: () => '#000' }),
  useGetBinaryMode: () => 'light',
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles: (fn: any) => (colors: any) => fn(colors),
  createGetStyles2024: (fn: any) => fn,
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const { FlatList } = require('react-native');
  return {
    BottomSheetFlatList: (props: any) => {
      lastListProps = props;
      return <FlatList {...props} />;
    },
  };
});
jest.mock('../customized/BottomSheet', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactLib.forwardRef((props: any, _ref: any) =>
      ReactLib.createElement(View, null, props.children),
    ),
  };
});
jest.mock('react-native-gesture-handler', () => {
  const { Pressable } = require('react-native');
  return { TouchableWithoutFeedback: Pressable };
});
jest.mock('@/components/AddressViewer', () => {
  const { Text } = require('react-native');
  return { AddressViewer: (props: any) => <Text>{props.address}</Text> };
});
jest.mock('@/utils/walletInfo', () => ({ getWalletIcon: () => () => null }));
jest.mock('@/core/apis/transactions', () => ({
  getGasTokenBalance: async () => ({
    rawBalance: '0',
    token: { decimals: 18, symbol: 'ETH' },
  }),
}));
jest.mock('@/utils/chain', () => ({
  findChain: () => ({ id: 1, serverId: 'eth', nativeTokenSymbol: 'ETH' }),
}));
jest.mock('@/assets/icons/gnosis', () => ({ RcIconEmptyCC: () => null }));
jest.mock('@/assets/icons/common', () => ({ RcIconCheckedCC: () => null }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/utils/number', () => ({
  formatTokenAmount: (value: string) => value,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../Button', () => {
  const { View } = require('react-native');
  return { Button: (props: any) => <View testID="button" {...props} /> };
});

export const __mockAccounts = accounts;

const renderPopup = (visible: boolean) =>
  render(
    <AccountSelectPopup
      visible={visible}
      title="select"
      onChange={jest.fn()}
      onCancel={jest.fn()}
      networkId="1"
      owners={[accounts[0]!.address]}
    />,
  );

it('keeps proceed disabled until an account is selected, then enables it', async () => {
  const view = renderPopup(true);

  expect(view.getAllByTestId('button')[1].props.disabled).toBe(true);
  expect(lastListProps.extraData).toBeNull();

  await act(async () => {
    fireEvent.press(view.getByText('acct-1'));
  });

  expect(view.getAllByTestId('button')[1].props.disabled).toBe(false);
  // The list itself must re-render with the new selection so rows and the
  // button can never disagree.
  expect(lastListProps.extraData).toEqual(accounts[0]);
});

it('starts every opening from an empty selection', async () => {
  const view = renderPopup(true);
  await act(async () => {
    fireEvent.press(view.getByText('acct-1'));
  });
  expect(view.getAllByTestId('button')[1].props.disabled).toBe(false);

  view.rerender(
    <AccountSelectPopup
      visible={false}
      title="select"
      onChange={jest.fn()}
      onCancel={jest.fn()}
      networkId="1"
    />,
  );
  view.rerender(
    <AccountSelectPopup
      visible
      title="select"
      onChange={jest.fn()}
      onCancel={jest.fn()}
      networkId="1"
    />,
  );

  expect(view.getAllByTestId('button')[1].props.disabled).toBe(true);
});
