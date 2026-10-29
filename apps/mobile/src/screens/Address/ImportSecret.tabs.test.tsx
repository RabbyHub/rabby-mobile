import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Keyboard, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { TouchableOpacity as GestureTouchableOpacity } from 'react-native-gesture-handler';
import { ImportSecret } from './ImportSecret';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { E2E_ID } from '@/constant/e2e';

const mockNavigation = {
  setOptions: jest.fn(),
  navigate: jest.fn(),
};
const mockSetPage = jest.fn();
const mockT = (key: string) => key;
const mockTheme = {
  styles: { tabActive: { backgroundColor: 'blue' } },
  colors2024: {},
};
const mockScanner = { text: '', clear: jest.fn() };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return ReactModule.forwardRef((props: object, ref: unknown) => {
    ReactModule.useImperativeHandle(ref, () => ({ setPage: mockSetPage }));
    return <NativeView {...props} />;
  });
});
// Keep CustomTouchableOpacity real and isolate only its native gesture host.
// This protects the selected host contract, not Fabric's device touch dispatch.
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: (props: object) => {
    const { View: NativeView } = require('react-native');
    return <NativeView {...props} />;
  },
}));
jest.mock('@/hooks/theme', () => ({ useTheme2024: () => mockTheme }));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
  Trans: () => null,
}));
jest.mock('@/utils/navigation', () => ({
  navigateDeprecated: jest.fn(),
  replaceToFirst: jest.fn(),
}));
jest.mock('@/constant/layout', () => ({ RootNames: {} }));
jest.mock('../Scanner/ScannerScreen', () => ({
  useScanner: () => mockScanner,
}));
jest.mock('@/components2024/PasteButton', () => () => null);
jest.mock('@/components2024/Form/Input', () => ({
  NextInput: {
    TextArea: ({ inputProps }: { inputProps: object }) => {
      const { TextInput } = require('react-native');
      return <TextInput {...inputProps} />;
    },
  },
}));
jest.mock('@/core/apis/privateKey', () => ({
  validateAndCleanPrivateKey: jest.fn(),
}));
jest.mock('@/core/apis/mnemonic', () => ({
  validateAndCleanMnemonic: jest.fn(),
}));
jest.mock('@/core/apis', () => ({ apiPrivateKey: {}, apiMnemonic: {} }));
jest.mock('@/core/apis/keyring', () => ({ requestKeyring: jest.fn() }));
jest.mock('@rabby-wallet/keyring-utils', () => ({
  KEYRING_CLASS: {},
  KEYRING_TYPE: {},
}));
jest.mock('@/assets/icons/address', () => ({ RcIconScannerCC: () => null }));
jest.mock(
  '@/components2024/ScreenContainer/FooterButtonScreenContainer',
  () => ({
    FooterButtonScreenContainer: ({ children }: React.PropsWithChildren) => (
      <>{children}</>
    ),
  }),
);
jest.mock('@/utils/clipboard', () => ({ onPastedSensitiveData: jest.fn() }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('./components/DuplicateAddressModal', () => ({
  useDuplicateAddressModal: () => ({ show: jest.fn() }),
}));
jest.mock('@/hooks/useShowImportMoreAddressPopup', () => ({
  useShowImportMoreAddressPopup: () => ({ showImportMorePopup: jest.fn() }),
}));
jest.mock('@/core/utils/secretVault', () => ({}));
jest.mock('@/utils/walletUnlock', () => ({
  ensureWalletUnlockedForAction: jest.fn(),
}));
jest.mock('@/core/native/utils', () => ({ IS_ANDROID: true }));
jest.mock('@/constant/env', () => ({ APP_RUNTIME_ENV: 'regression' }));

const seedPhraseLabel = 'page.manageAddress.seed-phrase';
const privateKeyLabel = 'page.manageAddress.private-key';
const seedPhrasePlaceholder =
  'page.newUserOnboarding.importSecret.seedPhrasePlaceholder';
const privateKeyPlaceholder =
  'page.newUserOnboarding.importSecret.privateKeyPlaceholder';

function renderImport(initialTab: 'seedPhrase' | 'privateKey' = 'seedPhrase') {
  function NavigationHost() {
    const [options, setOptions] = React.useState<{
      headerTitle?: React.ComponentType;
    }>({});
    React.useLayoutEffect(() => {
      mockNavigation.setOptions.mockImplementation(setOptions);
    }, []);
    const Header = options.headerTitle;
    return (
      <View>
        <ImportSecret
          route={{
            key: 'import-secret',
            name: 'ImportSecret',
            params: { initialTab },
          }}
          navigation={mockNavigation as never}
        />
        {Header && <Header />}
      </View>
    );
  }
  const view = render(<NavigationHost />);
  const pressTab = (label: string) => {
    fireEvent.press(view.getByText(label));
  };
  const getConfirm = () =>
    view.UNSAFE_getByType(FooterButtonScreenContainer).props.buttonProps;

  return { view, pressTab, getConfirm };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('uses gesture-handler hosts for both native-stack header tabs without dimming them', () => {
  const { view } = renderImport();
  const tabs = view.UNSAFE_getAllByType(GestureTouchableOpacity);

  expect(tabs).toHaveLength(2);
  tabs.forEach(tab => expect(tab.props.activeOpacity).toBe(1));
  expect(tabs[1].props.testID).toBe(E2E_ID.onboarding.privateKeyTab);
  expect(mockNavigation.setOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ headerTitleAlign: 'center' }),
  );
});

it.each(['seedPhrase', 'privateKey'] as const)(
  'switches both directions from %s, dismisses the keyboard, and preserves independent drafts',
  initialTab => {
    const { view, pressTab, getConfirm } = renderImport(initialTab);
    expect(view.UNSAFE_getByType(PagerView).props.initialPage).toBe(
      initialTab === 'privateKey' ? 1 : 0,
    );
    expect(view.UNSAFE_getByType(PagerView).props.keyboardDismissMode).toBe(
      'on-drag',
    );
    const container = view
      .UNSAFE_getAllByType(View)
      .find(node => node.props.onTouchStart === Keyboard.dismiss);
    expect(container).toBeDefined();
    expect(container?.props.onPress).toBeUndefined();
    expect(getConfirm().disabled).toBe(true);

    // Deliberately invalid text: no real mnemonic/key or import is involved.
    fireEvent.changeText(
      view.getByPlaceholderText(seedPhrasePlaceholder),
      'mnemonic draft',
    );
    pressTab(privateKeyLabel);
    expect(mockSetPage).toHaveBeenLastCalledWith(1);
    expect(getConfirm().disabled).toBe(true);
    expect(getConfirm().testID).toBe(E2E_ID.onboarding.privateKeySubmit);

    fireEvent.changeText(
      view.getByPlaceholderText(privateKeyPlaceholder),
      'private-key draft',
    );
    expect(getConfirm().disabled).toBe(false);
    pressTab(seedPhraseLabel);
    expect(mockSetPage).toHaveBeenLastCalledWith(0);
    expect(getConfirm().disabled).toBe(false);
    pressTab(privateKeyLabel);
    expect(mockSetPage.mock.calls).toEqual([[1], [0], [1]]);
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(3);
    expect(view.getByPlaceholderText(seedPhrasePlaceholder).props.value).toBe(
      'mnemonic draft',
    );
    expect(view.getByPlaceholderText(privateKeyPlaceholder).props.value).toBe(
      'private-key draft',
    );
    expect(
      view.getByPlaceholderText(privateKeyPlaceholder).props.secureTextEntry,
    ).toBe(true);
    expect(
      view.getByPlaceholderText(seedPhrasePlaceholder).props.secureTextEntry,
    ).toBe(true);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  },
);

it('keeps header selection synchronized when the pager is swiped', () => {
  const { view, getConfirm } = renderImport();
  act(() => {
    view.UNSAFE_getByType(PagerView).props.onPageSelected({
      nativeEvent: { position: 1 },
    });
  });
  const tabs = view.UNSAFE_getAllByType(GestureTouchableOpacity);
  expect(tabs[1].props.style).toContain(mockTheme.styles.tabActive);
  expect(tabs[0].props.style).not.toContain(mockTheme.styles.tabActive);
  expect(getConfirm().testID).toBe(E2E_ID.onboarding.privateKeySubmit);
  expect(mockSetPage).not.toHaveBeenCalled();
});
