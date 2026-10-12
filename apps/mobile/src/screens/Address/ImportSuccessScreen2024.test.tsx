import React from 'react';
import { render } from '@testing-library/react-native';
import { ImportSuccessScreen2024 } from './ImportSuccessScreen2024';
jest.mock('@/constant', () => ({ isNonPublicProductionEnv: false }));
jest.mock('@/utils/events', () => ({ eventBus: { emit: jest.fn() } }));

const mockParams = {
  address: ['0x0000000000000000000000000000000000000001'],
  type: 'Watch Address',
  brandName: 'Watch Address',
};
const mockCard = jest.fn((_props: any) => null);
const mockButton = jest.fn((_props: any) => null);
const mockFetchAccounts = jest.fn();
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
jest.mock('@/components2024/GlobalBottomSheetModal', () => ({}));
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

it('has the single imported address and View Wallet action on its first render', () => {
  jest.useFakeTimers();
  try {
    render(<ImportSuccessScreen2024 />);
    expect(mockCard.mock.calls[0][0].addresses).toHaveLength(1);
    expect(mockCard.mock.calls[0][0].title).toBe(
      'page.importSuccess.titleImported',
    );
    expect(mockButton.mock.calls[0][0].title).toBe(
      'page.importSuccess.viewAddress',
    );
  } finally {
    jest.useRealTimers();
  }
});
