import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { DestinationChain, RecipientAddress } from './WithdrawSelectPopup';
import { findChainByServerID } from '@/utils/chain';

const mockAccount = {
  address: '0x1111111111111111111111111111111111111111',
  aliasName: 'A very long recipient wallet name',
};
let mockStyles: Record<string, any>;
let mockRenderListItem = false;

jest.mock('@/hooks/account', () => ({
  useAccounts: () => ({ accounts: [mockAccount] }),
}));
jest.mock('@/hooks/theme', () => {
  const colors = new Proxy({}, { get: (_, key) => String(key) });
  return {
    useTheme2024: ({ getStyle }: any) => {
      mockStyles = getStyle.getStyles({
        classicalColors: colors,
        colors,
        colors2024: colors,
        isLight: true,
        safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return { styles: mockStyles, colors2024: colors, isLight: true };
    },
  };
});
jest.mock('@/components', () => ({
  AppBottomSheetModal: ({ children }: any) => children,
  AssetAvatar: () => null,
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: require('react-native').ScrollView,
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: jest.fn(),
  removeGlobalBottomSheetModal2024: jest.fn(),
}));
jest.mock('@/components2024/ListItem/ListItem', () => ({
  ListItem: ({ content }: any) => (mockRenderListItem ? content : null),
}));
jest.mock('@/components2024/AddressItem/AddressItem', () => ({
  AddressItem: ({ children, style }: any) => {
    const { Text: NativeText, View: NativeView } = require('react-native');
    return (
      <NativeView style={style} testID="recipient-account">
        {children({
          WalletIcon: () => null,
          WalletName: ({ style: textStyle }: any) => (
            <NativeText style={textStyle}>{mockAccount.aliasName}</NativeText>
          ),
          WalletBalance: () => null,
        })}
      </NativeView>
    );
  },
}));
jest.mock('@/screens/Address/components/AddressItemShadowView', () => ({
  AddressItemShadowView: require('react-native').View,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components2024/Button', () => ({ Button: () => null }));
jest.mock('@/utils/chain', () => ({ findChainByServerID: jest.fn() }));
jest.mock('@/utils/number', () => ({
  formatUsdValue: (value: number) => `$${value}`,
}));
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('@rneui/themed', () => ({ Skeleton: () => null }));
jest.mock('@/assets2024/icons/common/help.svg', () => () => null);
jest.mock('@/assets/icons/select-chain/icon-checked.svg', () => () => null);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Component/style contracts only. Fabric width, clipping and shadows must
// additionally be checked in the native recipient sheet on a narrow screen.
describe('withdraw recipient layout', () => {
  const item = {
    recharge_addr: mockAccount.address,
    total_withdraw_limit: 786.65,
  } as any;

  it('keeps the account shrinkable and reserves a non-shrinking limit column', () => {
    const onChange = jest.fn();
    const view = render(
      <RecipientAddress
        address={mockAccount.address}
        list={[item]}
        onChange={onChange}
      />,
    );

    expect(
      StyleSheet.flatten(view.getByTestId('recipient-account').props.style),
    ).toMatchObject({
      flex: 1,
      minWidth: 0,
    });
    expect(
      StyleSheet.flatten(view.getByText(mockAccount.aliasName).props.style),
    ).toMatchObject({
      flexShrink: 1,
      minWidth: 0,
    });
    expect(
      StyleSheet.flatten(view.getByText('$786.65').props.style),
    ).toMatchObject({
      minWidth: 92,
      flexShrink: 0,
      textAlign: 'right',
    });
    fireEvent.press(view.UNSAFE_getByType(TouchableOpacity));
    expect(onChange).toHaveBeenCalledWith(item);
  });

  it('keeps header, gradient and list in the same bounded content width', () => {
    const view = render(
      <RecipientAddress address={mockAccount.address} list={[item]} />,
    );
    expect(mockStyles.recipientLimitHeader).toMatchObject({
      maxWidth: '50%',
      flexShrink: 0,
    });
    expect(mockStyles.contentGradient).toMatchObject({
      alignSelf: 'stretch',
      flexGrow: 1,
    });
    expect(mockStyles.contentGradient.paddingHorizontal).toBeUndefined();
    expect(mockStyles.recipientHeaderRow.paddingHorizontal).toBe(
      mockStyles.flex1.paddingHorizontal,
    );
    expect(mockStyles.innerRow).toMatchObject({
      minWidth: 0,
      gap: 12,
      alignSelf: 'stretch',
    });
    expect(mockStyles.shadowSelected.padding).toBeUndefined();
    expect(view.UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
  });
});

describe('withdraw destination chain', () => {
  const offline = { chain_id: 'offline', withdraw_limit: 1 } as any;
  const eth = { chain_id: 'eth', withdraw_limit: 1 } as any;

  beforeEach(() => {
    mockRenderListItem = true;
    (findChainByServerID as jest.Mock).mockImplementation((id: string) =>
      id === 'eth' ? { name: 'Ethereum', logo: 'eth.png' } : null,
    );
  });

  afterEach(() => {
    mockRenderListItem = false;
  });

  it('skips chains that are no longer supported locally', () => {
    const view = render(
      <DestinationChain
        chain={offline}
        list={[offline, eth]}
        onSelect={jest.fn()}
      />,
    );
    expect(view.getAllByText('Ethereum')).toHaveLength(1);
    expect(
      view.getByText('page.gasAccount.withdrawPopup.selectChain'),
    ).toBeTruthy();
  });
});
