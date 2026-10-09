import { AppState, Linking } from 'react-native';

import { allowLinkOpen } from '@/constant/dappView';
import type { Tab } from '@/core/services/browserService';
import {
  canBrowserTabOpenExternalUrl,
  hydrateBrowserTabs,
  resetTabsStore,
  setBrowserState,
} from './useBrowser';

const walletConnectUrl = 'wc:browser-integration-session@2';
const sourceTabId = 'opensea-tab';
const otherTabId = 'other-tab';
const tabs: Tab[] = [sourceTabId, otherTabId].map(id => ({
  id,
  url: `https://${id}.example`,
  initialUrl: `https://${id}.example`,
  openTime: 1,
  isDapp: true,
}));

const visibleBrowserState = {
  isShowBrowser: true,
  isShowSearch: false,
  isShowManage: false,
  isShowFavorite: false,
  isShowDappInfo: false,
};

// Keep one callback across store transitions, as a mounted/frozen tab does.
const canOpenFromSourceTab = () => canBrowserTabOpenExternalUrl(sourceTabId);

async function restoreTabs(activeTabId = sourceTabId, restoredTabs = tabs) {
  await hydrateBrowserTabs(async () => ({
    activeTabId,
    tabs: restoredTabs,
  }));
}

describe('browser external navigation integration', () => {
  const initialAppState = AppState.currentState;

  beforeEach(async () => {
    resetTabsStore();
    setBrowserState(visibleBrowserState);
    AppState.currentState = 'active';
    jest.spyOn(Linking, 'canOpenURL').mockReset().mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(undefined);
    await restoreTabs();
  });

  afterEach(() => {
    resetTabsStore();
    setBrowserState({ ...visibleBrowserState, isShowBrowser: false });
    AppState.currentState = initialAppState;
    jest.restoreAllMocks();
  });

  it('allows WalletConnect from the active restored tab even when its persisted termination flag is set', async () => {
    await restoreTabs(
      sourceTabId,
      tabs.map(tab => ({ ...tab, isTerminate: true })),
    );

    await allowLinkOpen(walletConnectUrl, canOpenFromSourceTab);

    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(walletConnectUrl);
  });

  it('does not let a mounted inactive tab launch another app', async () => {
    await allowLinkOpen(walletConnectUrl, () =>
      canBrowserTabOpenExternalUrl(otherTabId),
    );

    expect(Linking.canOpenURL).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('uses the latest selected tab instead of the callback creation state', async () => {
    await restoreTabs(otherTabId);
    await allowLinkOpen(walletConnectUrl, canOpenFromSourceTab);

    expect(Linking.openURL).not.toHaveBeenCalled();

    await restoreTabs();
    expect(Linking.openURL).not.toHaveBeenCalled();

    await allowLinkOpen(walletConnectUrl, canOpenFromSourceTab);
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(walletConnectUrl);
  });

  it('blocks the former current tab after the browser closes', async () => {
    setBrowserState({ isShowBrowser: false });

    await allowLinkOpen(walletConnectUrl, canOpenFromSourceTab);

    expect(Linking.canOpenURL).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it.each([
    'isShowSearch',
    'isShowManage',
    'isShowFavorite',
    'isShowDappInfo',
  ] as const)('blocks the covered tab while %s is open', async overlay => {
    setBrowserState({ [overlay]: true });

    await allowLinkOpen(walletConnectUrl, canOpenFromSourceTab);

    expect(Linking.canOpenURL).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it.each(['inactive', 'background'] as const)(
    'does not launch another app while Rabby is %s',
    async appState => {
      AppState.currentState = appState;

      await allowLinkOpen(walletConnectUrl, canOpenFromSourceTab);

      expect(Linking.canOpenURL).not.toHaveBeenCalled();
      expect(Linking.openURL).not.toHaveBeenCalled();
    },
  );

  it('requires the source tab to exist even when the active ID still matches', async () => {
    await restoreTabs(
      sourceTabId,
      tabs.filter(tab => tab.id !== sourceTabId),
    );

    await allowLinkOpen(walletConnectUrl, canOpenFromSourceTab);

    expect(Linking.canOpenURL).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it.each(['switch-tab', 'close-browser', 'background'] as const)(
    'drops an outstanding OS capability result after %s and permits a fresh request on return',
    async transition => {
      let resolveCapability!: (supported: boolean) => void;
      jest.spyOn(Linking, 'canOpenURL').mockImplementationOnce(
        () =>
          new Promise<boolean>(resolve => {
            resolveCapability = resolve;
          }),
      );
      const pendingOpen = allowLinkOpen(walletConnectUrl, canOpenFromSourceTab);
      expect(Linking.canOpenURL).toHaveBeenCalledWith(walletConnectUrl);

      if (transition === 'switch-tab') {
        await restoreTabs(otherTabId);
      } else if (transition === 'close-browser') {
        setBrowserState({ isShowBrowser: false });
      } else {
        AppState.currentState = 'background';
      }

      resolveCapability(true);
      await pendingOpen;
      expect(Linking.openURL).not.toHaveBeenCalled();

      await restoreTabs();
      setBrowserState(visibleBrowserState);
      AppState.currentState = 'active';
      expect(Linking.openURL).not.toHaveBeenCalled();

      await allowLinkOpen(walletConnectUrl, canOpenFromSourceTab);
      expect(Linking.openURL).toHaveBeenCalledTimes(1);
      expect(Linking.openURL).toHaveBeenCalledWith(walletConnectUrl);
    },
  );
});
