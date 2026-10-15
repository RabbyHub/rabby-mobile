import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ImportSuccessScreen2024 } from './ImportSuccessScreen2024';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
jest.mock('@/constant', () => ({ isNonPublicProductionEnv: false }));
jest.mock('@/utils/events', () => ({ eventBus: { emit: jest.fn() } }));

const mockParams: {
  address: string[];
  type: string;
  brandName: string;
  isFirstImport?: boolean;
  skipSuccessAnimation?: boolean;
} = {
  address: ['0x0000000000000000000000000000000000000001'],
  type: 'Watch Address',
  brandName: 'Watch Address',
};
const mockCard = jest.fn((_props: any) => null);
const mockButton = jest.fn((_props: any) => null);
const mockFetchAccounts = jest.fn();
const mockCreateModal = jest.fn();
const mockRemoveModal = jest.fn();
const mockT = (key: string) => key;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({}),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/hooks/account', () => ({
  useAccounts: () => ({ accounts: [], fetchAccounts: mockFetchAccounts }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/components', () => ({ Text: require('react-native').Text }));
jest.mock('@/components2024/WalletSuccessCard', () => ({
  WalletSuccessCard: (props: any) => mockCard(props),
}));
jest.mock('@/components2024/Button', () => ({
  Button: (props: any) => mockButton(props),
}));
jest.mock('@/assets/icons/common/right-2-cc.svg', () => () => null);
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock('@/core/serviceApi/contact', () => ({
  getContactAliasSnapshot: () => null,
  contactServiceApi: { setAlias: jest.fn() },
}));
jest.mock('@/core/serviceApi/preference', () => ({
  getFallbackAccountSnapshot: () => null,
}));
jest.mock('@/utils/analytics', () => ({ matomoRequestEvent: jest.fn() }));
jest.mock('@/utils/transaction', () => ({
  getKRCategoryByType: () => 'watch',
}));
jest.mock('@/utils/address', () => ({
  ellipsisAddress: () => 'public-address',
}));
jest.mock('./components/GnosisSupportChainList', () => ({
  GnosisSupportChainList: () => null,
}));
jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: (...args: unknown[]) =>
    mockCreateModal(...args),
  removeGlobalBottomSheetModal2024: (...args: unknown[]) =>
    mockRemoveModal(...args),
}));
jest.mock('@/store/balance', () => ({ batchGetTotalBalance: jest.fn() }));
jest.mock('@/store/tokens', () => ({
  getState: () => ({ getTokenList: jest.fn() }),
}));
jest.mock('@/store/protocols', () => ({
  getState: () => ({ getProtocols: jest.fn() }),
}));
jest.mock('@/databases/hooks/history', () => ({
  syncMultiAddressesHistory: jest.fn(),
}));
jest.mock('@/hooks/navigation', () => ({}));
jest.mock('../Home/hooks/singleHome', () => ({}));
jest.mock('@/core/apis/account', () => ({
  accountEvents: { emit: jest.fn() },
}));
jest.mock('@/core/utils/secretVault', () => ({}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.isFirstImport = false;
  mockParams.skipSuccessAnimation = undefined;
  mockCreateModal.mockReturnValue('IMPORT_MORE_ADDRESS_test');
  mockRemoveModal.mockResolvedValue(undefined);
});

it.each([
  [KEYRING_TYPE.WatchAddressKeyring, 1, 'page.importSuccess.viewAddress'],
  [KEYRING_TYPE.HdKeyring, 1, 'page.importSuccess.viewAddress'],
  [KEYRING_TYPE.HdKeyring, 2, 'global.Done'],
  [KEYRING_TYPE.LedgerKeyring, 1, 'page.importSuccess.viewAddress'],
  [KEYRING_TYPE.TrezorKeyring, 1, 'page.importSuccess.viewAddress'],
])(
  'renders %s with %s addresses and the correct action immediately',
  (type, count, title) => {
    mockCard.mockClear();
    mockButton.mockClear();
    mockParams.type = type;
    mockParams.brandName = type;
    mockParams.address = Array.from(
      { length: count },
      (_, index) => `0x${String(index + 1).padStart(40, '0')}`,
    );
    jest.useFakeTimers();
    try {
      render(<ImportSuccessScreen2024 />);
      expect(mockCard.mock.calls[0][0].addresses).toHaveLength(count);
      expect(mockCard.mock.calls[0][0].title).toBe(
        count === 1
          ? 'page.importSuccess.titleImported'
          : 'page.importSuccess.titleMultiple',
      );
      expect(mockButton.mock.calls[0][0].title).toBe(title);
    } finally {
      jest.useRealTimers();
    }
  },
);

it.each([undefined, false, true])(
  'maps skipSuccessAnimation=%s to the success-card animation policy',
  skipSuccessAnimation => {
    mockParams.skipSuccessAnimation = skipSuccessAnimation;
    jest.useFakeTimers();
    try {
      render(<ImportSuccessScreen2024 />);

      expect(mockCard.mock.calls[0][0].autoPlay).toBe(!skipSuccessAnimation);
    } finally {
      jest.useRealTimers();
    }
  },
);

it('marks additional imports for immediate success content and waits for sheet dismissal', async () => {
  mockParams.type = KEYRING_TYPE.WatchAddressKeyring;
  mockParams.brandName = KEYRING_TYPE.WatchAddressKeyring;
  mockParams.isFirstImport = true;
  let finishDismiss!: () => void;
  const dismissal = new Promise<void>(resolve => {
    finishDismiss = resolve;
  });
  mockRemoveModal.mockReturnValue(dismissal);
  jest.useFakeTimers();
  try {
    const view = render(<ImportSuccessScreen2024 />);
    await act(async () => {
      fireEvent.press(view.getByText('page.importSuccess.importMore'));
    });
    const configuration = mockCreateModal.mock.calls[0][0];
    expect(configuration.params.skipSuccessAnimation).toBe(true);

    let dismissed = false;
    const cancellation = configuration.onCancel();
    expect(cancellation).toBeInstanceOf(Promise);
    cancellation.then(() => {
      dismissed = true;
    });
    await Promise.resolve();
    expect(dismissed).toBe(false);
    expect(mockRemoveModal).toHaveBeenCalledWith('IMPORT_MORE_ADDRESS_test', {
      waitForDismiss: true,
    });

    finishDismiss();
    await cancellation;
    expect(dismissed).toBe(true);
  } finally {
    finishDismiss();
    jest.useRealTimers();
  }
});
