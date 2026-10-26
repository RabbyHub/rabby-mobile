import React from 'react';
import { Image } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { Cex, ProjectItem } from '@rabby-wallet/rabby-api/dist/types';
import { ellipsisAddress } from '@/utils/address';

const mockGetCexWithLocalCache = jest.fn();
const mockHandleFieldChange = jest.fn();
let mockSupportedCexList: ProjectItem[] = [];
let mockAddrDesc: any;
let mockToAccount: any;
let mockToAddress = '';
let mockSelectAccountProps: any;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/AccountSelectModalTx/SelectAccountSheetModal', () => ({
  SheetModalSelectAccountSend: (props: any) => {
    mockSelectAccountProps = props;
    return null;
  },
}));

jest.mock('@/components2024/AddressItem/AddressItem', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  const MockWalletIcon = () =>
    ReactModule.createElement(View, { testID: 'wallet-icon' });

  return {
    AddressItem: ({ children }: any) =>
      ReactModule.createElement(
        View,
        null,
        children({ WalletIcon: MockWalletIcon }),
      ),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: new Proxy({}, { get: () => ({}) }),
    colors2024: new Proxy({}, { get: () => '#000' }),
  }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: () => ({}),
}));

jest.mock('@/components2024/Card', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');

  return {
    Card: ({ children, onPress }: any) =>
      ReactModule.createElement(
        Pressable,
        { testID: 'recipient-card', onPress },
        children,
      ),
  };
});

jest.mock('@/assets/icons/send', () => ({
  RcIconLockCC: () => null,
  RcIconSwitchCC: () => null,
}));

jest.mock('@/hooks/whitelist', () => ({
  useWhitelist: () => ({ isAddrOnWhitelist: () => false }),
}));

jest.mock('@/screens/Address/components/AddressItemShadowView', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    AddressItemShadowView: ({ children }: any) =>
      ReactModule.createElement(View, null, children),
  };
});

jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: jest.fn(),
  removeGlobalBottomSheetModal2024: jest.fn(),
}));

jest.mock('@/components2024/GlobalBottomSheetModal/types', () => ({
  MODAL_NAMES: { ADDRESS_HIGHT_DESC: 'ADDRESS_HIGHT_DESC' },
}));

jest.mock('@/databases/hooks/cex', () => ({
  getCexWithLocalCache: (...args: unknown[]) =>
    mockGetCexWithLocalCache(...args),
}));

jest.mock('@/hooks/alias', () => ({
  useAlias2: () => ({ adderssAlias: '' }),
}));

// Keep makeAccountObject real; its unrelated account-list re-exports are not
// part of this component's presentation contract.
jest.mock('@/core/apis/account', () => ({}));

jest.mock('../icons/unknown-address-avatar-cc.svg', () => () => null);
jest.mock('../icons', () => ({ RcIconTipRightCC: () => null }));

jest.mock('@/components/Icons/CaretArrowIconCC', () => ({
  CaretArrowIconCC: () => null,
}));

jest.mock('../hooks/useSendToken', () => ({
  useSendTokenFormValuesSelector: (selector: any) =>
    selector({ to: mockToAddress }),
  useSendTokenScreenStateSelector: (selector: any) =>
    selector({ toAddrDesc: mockAddrDesc }),
  useSendTokenInternalShallowSelector: (selector: any) =>
    selector({
      callbacks: { handleFieldChange: mockHandleFieldChange },
      computed: {
        toAccount: mockToAccount,
        toAddressPositiveTips: {},
      },
    }),
}));

jest.mock('@/constant/e2e', () => ({
  E2E_ID: { send: { toSection: 'send-to-section' } },
}));

jest.mock('@/utils/makeTestIDProps', () => ({
  makeTestIDProps: (testID: string) => ({ testID }),
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/useCexSupportList', () => ({
  useCexSupportList: () => ({ list: mockSupportedCexList }),
}));

const { default: ToAddressControl2024, ToAccountEntry } =
  require('./ToAddressControl2024') as typeof import('./ToAddressControl2024');

const unsupportedAddress = '0x0000175c4ADC489fd307e084dE4Efd133158C50a';
const supportedAddress = '0x00002C55760f6f57C218cD293bEdd434C5171010';
const otherAddress = '0x0000000000000000000000000000000000000001';

const bitget: ProjectItem = {
  id: 'bitget',
  name: 'Bitget',
  logo_url: 'https://example.com/bitget.png',
  site_url: 'https://www.bitget.com',
};

const cryptoCex: Cex = {
  id: 'crypto',
  name: 'Crypto.com',
  logo_url: 'https://example.com/crypto.png',
  is_deposit: true,
};

const bitgetCex: Cex = {
  id: bitget.id,
  name: bitget.name,
  logo_url: bitget.logo_url,
  is_deposit: true,
};

const makeAccount = (address: string) => ({
  address,
  aliasName: '',
  balance: 0,
  type: 'WatchAddressKeyring',
  brandName: 'WatchAddressKeyring',
});

const makeAddrDesc = (address: string, cex?: Cex) => ({
  id: address,
  cex,
  usd_value: 0,
  born_at: 0,
  is_danger: false,
  is_spam: false,
  is_scam: false,
  name: '',
});

describe('ToAddressControl2024 CEX avatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupportedCexList = [bitget];
    mockToAccount = makeAccount(unsupportedAddress);
    mockAddrDesc = makeAddrDesc(unsupportedAddress, cryptoCex);
    mockGetCexWithLocalCache.mockResolvedValue(undefined);
  });

  it('uses the default avatar for an unsupported backend deposit CEX', () => {
    const view = render(<ToAddressControl2024 />);

    expect(view.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(screen.getByTestId('wallet-icon')).toBeTruthy();
    expect(mockGetCexWithLocalCache).not.toHaveBeenCalled();
  });

  it('uses canonical supported-list metadata for a supported CEX', () => {
    mockToAccount = makeAccount(supportedAddress);
    mockAddrDesc = makeAddrDesc(supportedAddress, {
      ...bitgetCex,
      name: 'stale name',
      logo_url: 'https://example.com/stale.png',
    });

    const view = render(<ToAddressControl2024 />);
    const images = view.UNSAFE_getAllByType(Image);

    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: bitget.logo_url });
    expect(screen.queryByTestId('wallet-icon')).toBeNull();
  });

  it('uses the filtered local-cache fallback before current address data loads', async () => {
    mockGetCexWithLocalCache.mockResolvedValue(bitgetCex);

    render(
      <ToAccountEntry
        account={makeAccount(supportedAddress)}
        isSelectingAccount={false}
        onPress={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.UNSAFE_getAllByType(Image)).toHaveLength(1);
    });
    expect(mockGetCexWithLocalCache).toHaveBeenCalledWith(
      supportedAddress,
      false,
      true,
    );
  });

  it('ignores a late cache result after the address changes', async () => {
    let resolveOldRequest: (cex: Cex | undefined) => void = () => {};
    mockGetCexWithLocalCache.mockImplementationOnce(
      () =>
        new Promise<Cex | undefined>(resolve => {
          resolveOldRequest = resolve;
        }),
    );

    const view = render(
      <ToAccountEntry
        account={makeAccount(supportedAddress)}
        isSelectingAccount={false}
        onPress={jest.fn()}
      />,
    );

    view.rerender(
      <ToAccountEntry
        account={makeAccount(otherAddress)}
        displayCex={null}
        isSelectingAccount={false}
        onPress={jest.fn()}
      />,
    );

    await act(async () => {
      resolveOldRequest(bitgetCex);
      await Promise.resolve();
    });

    expect(view.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(screen.getByTestId('wallet-icon')).toBeTruthy();
  });
});

// Component render contract. Provider publication and native transition timing
// still need the real Send screen/device; the store inputs are controlled here.
describe('ToAddressControl2024 initial recipient presentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupportedCexList = [];
    mockToAccount = null;
    mockToAddress = '';
    mockAddrDesc = undefined;
    mockSelectAccountProps = undefined;
    mockGetCexWithLocalCache.mockResolvedValue(undefined);
  });

  it.each(['', otherAddress])(
    'renders the To section from form address %j before derived state arrives',
    async toAddress => {
      mockToAddress = toAddress;
      render(<ToAddressControl2024 />);

      expect(screen.getByTestId('send-to-section')).toBeTruthy();
      expect(screen.getByText('page.sendToken.To')).toBeTruthy();
      expect(
        screen.getAllByText(
          toAddress
            ? ellipsisAddress(toAddress)
            : 'page.sendToken.sectionTo.selectPlaceholder',
        ).length,
      ).toBeGreaterThan(0);
      expect(mockHandleFieldChange).not.toHaveBeenCalled();
      await act(async () => {});
    },
  );

  it('lets the enriched derived account take over without hiding the section', async () => {
    mockToAddress = otherAddress;
    const view = render(<ToAddressControl2024 />);
    expect(screen.getByTestId('send-to-section')).toBeTruthy();
    mockToAccount = {
      ...makeAccount(otherAddress),
      aliasName: 'Imported wallet',
    };

    view.rerender(<ToAddressControl2024 style={{ marginTop: 16 }} />);

    expect(screen.getByTestId('send-to-section')).toBeTruthy();
    expect(screen.getByText('Imported wallet')).toBeTruthy();
    expect(mockHandleFieldChange).not.toHaveBeenCalled();
    await act(async () => {});
  });

  it('preserves the account selector callback while derived state is pending', () => {
    render(<ToAddressControl2024 />);
    fireEvent.press(screen.getByTestId('recipient-card'), {
      stopPropagation: jest.fn(),
    });
    expect(mockSelectAccountProps.visible).toBe(true);

    act(() =>
      mockSelectAccountProps.onSelectAccount(makeAccount(otherAddress)),
    );

    expect(mockHandleFieldChange).toHaveBeenCalledTimes(1);
    expect(mockHandleFieldChange).toHaveBeenCalledWith('to', otherAddress);
    expect(mockSelectAccountProps.visible).toBe(false);
  });
});
