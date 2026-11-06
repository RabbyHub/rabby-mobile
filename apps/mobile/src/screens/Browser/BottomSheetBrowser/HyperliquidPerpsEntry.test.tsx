import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { RootNames } from '@/constant/layout';
import { browserPerpsNavigation } from '@/hooks/browser/browserPerpsNavigation';
import {
  navigateToPerpsHome,
  navigateToPreferredPerps,
} from '@/hooks/perps/navigation/navigateToPreferredPerps';
import { HyperliquidPerpsEntry } from './HyperliquidPerpsEntry';

let mockAndroid = true;
let mockAvailable = true;
let mockTabId = 'hyperliquid';
let mockConnected = false;
const mockClose = jest.fn();
const mockPush = jest.fn();

jest.mock('@/core/native/utils', () => ({
  get IS_ANDROID() {
    return mockAndroid;
  },
  get IS_IOS() {
    return !mockAndroid;
  },
}));
jest.mock('@/hooks/browser/useBrowser', () => ({
  useBrowser: () => ({
    activeTabId: mockTabId,
    setPartialBrowserState: mockClose,
  }),
  canBrowserTabOpenExternalUrl: (tabId: string) =>
    mockAvailable && tabId === mockTabId,
}));
jest.mock('@/utils/navigation', () => ({
  naviPush: (...args: unknown[]) => mockPush(...args),
  navigationRef: { isReady: () => true },
}));
jest.mock('@/hooks/perps/navigation/navigateToPreferredPerps', () => ({
  navigateToPerpsHome: jest.fn(),
  navigateToPreferredPerps: jest.fn(),
}));
jest.mock('@/hooks/account', () => ({
  storeApiAccounts: { getAccounts: () => [] },
}));
jest.mock('@/hooks/appSettings', () => ({
  useEnablePerpsWatchAddress: () => ({ enablePerpsWatchAddress: false }),
}));
jest.mock('@/hooks/useDapps', () => ({ useDapps: () => ({ dapps: {} }) }));
jest.mock('./hyperliquidPerpsAccount', () => ({
  HYPERLIQUID_APP_ORIGIN: 'https://app.hyperliquid.xyz',
  resolveHyperliquidPerpsAccount: () =>
    mockConnected ? { address: '0xabc' } : undefined,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {}, isLight: true }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/assets/icons/common', () => ({ RcIconJumpCC: () => null }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@react-native-community/blur', () => ({ BlurView: () => null }));
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: require('react-native').TouchableOpacity,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const homeNavigation = jest.mocked(navigateToPerpsHome);
const preferredNavigation = jest.mocked(navigateToPreferredPerps);
const press = (view: ReturnType<typeof render>) =>
  fireEvent.press(view.getByText('page.browser.openInRabbyPerps'));
const appear = (requestId: number, closing = false, isFocused = true) =>
  act(() =>
    browserPerpsNavigation.onTransitionEnd({ requestId, closing, isFocused }),
  );

// Component contract: real entry and handoff coordinator, mocked account,
// browser and navigation dependencies. This does not assert native frame timing.
describe('Hyperliquid browser to Perps handoff', () => {
  let finishPreparation: () => void;
  let changeAppState: (state: AppStateStatus) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_, listener) => {
        changeAppState = listener;
        return { remove: jest.fn() };
      });
    mockAndroid = true;
    mockAvailable = true;
    mockConnected = false;
    mockTabId = 'hyperliquid';
    const preparation = new Promise<void>(resolve => {
      finishPreparation = resolve;
    });
    const navigate: typeof navigateToPerpsHome = async ({ navigation }) => {
      await preparation;
      navigation.push(RootNames.StackTransaction, {
        screen: RootNames.Perps,
        params: {},
      });
      return 'simple';
    };
    homeNavigation.mockImplementation(navigate);
    preferredNavigation.mockImplementation(navigate);
  });

  afterEach(() => jest.restoreAllMocks());

  const finish = async () =>
    act(async () => {
      finishPreparation();
    });

  it.each([false, true])(
    'keeps the browser until its destination appears (connected: %s)',
    async connected => {
      mockConnected = connected;
      const view = render(<HyperliquidPerpsEntry />);
      press(view);
      press(view);
      expect(
        connected ? preferredNavigation : homeNavigation,
      ).toHaveBeenCalledTimes(1);
      expect(mockClose).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();

      await finish();
      const id = mockPush.mock.calls[0][1].browserPerpsNavigationId;
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockClose).not.toHaveBeenCalled();
      appear(id + 1);
      appear(id, true);
      appear(id, false, false);
      expect(mockClose).not.toHaveBeenCalled();
      appear(id);
      appear(id);
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(mockClose).toHaveBeenCalledWith({
        isShowBrowser: false,
        isShowSearch: false,
        searchText: '',
        searchTabId: '',
        trigger: '',
      });
    },
  );

  it.each(['unmount', 'tab-change', 'background', 'unavailable'] as const)(
    'does not dispatch a delayed push after %s',
    async reason => {
      const view = render(<HyperliquidPerpsEntry />);
      press(view);
      if (reason === 'unmount') {
        view.unmount();
      } else if (reason === 'tab-change') {
        mockTabId = 'another-tab';
        view.rerender(<HyperliquidPerpsEntry />);
      } else if (reason === 'background') {
        act(() => changeAppState('background'));
      } else {
        mockAvailable = false;
      }
      await finish();
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockClose).not.toHaveBeenCalled();
    },
  );

  it('ignores an appearance event from a cancelled request after reopening', async () => {
    const first = render(<HyperliquidPerpsEntry />);
    press(first);
    await finish();
    const oldId = mockPush.mock.calls[0][1].browserPerpsNavigationId;
    first.unmount();
    const reopened = render(<HyperliquidPerpsEntry />);
    press(reopened);
    await act(async () => {});
    appear(oldId);
    expect(mockClose).not.toHaveBeenCalled();
    appear(mockPush.mock.calls[1][1].browserPerpsNavigationId);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('leaves the browser open on failure and allows a retry', async () => {
    homeNavigation.mockResolvedValueOnce(false);
    const view = render(<HyperliquidPerpsEntry />);
    press(view);
    await act(async () => {});
    expect(mockClose).not.toHaveBeenCalled();
    press(view);
    await finish();
    expect(homeNavigation).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('preserves immediate closing on iOS without a handoff marker', async () => {
    mockAndroid = false;
    const view = render(<HyperliquidPerpsEntry />);
    press(view);
    expect(mockClose).toHaveBeenCalledTimes(1);
    await finish();
    expect(mockPush).toHaveBeenCalledWith(RootNames.StackTransaction, {
      screen: RootNames.Perps,
      params: {},
    });
  });
});
