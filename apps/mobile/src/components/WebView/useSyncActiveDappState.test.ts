import { renderHook } from '@testing-library/react-native';

import {
  getActiveDappState,
  globalSetActiveDappState,
} from '@/core/bridges/state';

import {
  INNER_GLOBAL_TAB_ID,
  useSyncActiveDappState,
} from './useSyncActiveDappState';

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_ORIGIN: 'https://rabby.io',
}));

const POLYMARKET = 'https://polymarket.com';
const BROWSER_TAB_ID = 'browser-tab';

type HookProps = Parameters<typeof useSyncActiveDappState>[0];

const makeProps = (overrides: Partial<HookProps> = {}): HookProps => ({
  dappOrigin: 'https://polymarket.com/',
  webviewIdRef: { current: 'inner-webview' },
  offscreenPreload: false,
  webviewActive: true,
  ...overrides,
});

const openBrowserTab = () => {
  globalSetActiveDappState({
    dappOrigin: POLYMARKET,
    tabId: BROWSER_TAB_ID,
    isScreenHide: false,
  });
};

describe('useSyncActiveDappState', () => {
  beforeEach(() => {
    globalSetActiveDappState({
      dappOrigin: null,
      tabId: null,
      isScreenHide: true,
    });
  });

  it('publishes an active webview as the visible active dapp', () => {
    const props = makeProps();
    renderHook(useSyncActiveDappState, { initialProps: props });

    expect(getActiveDappState()).toMatchObject({
      dappOrigin: POLYMARKET,
      tabId: 'inner-webview',
      isScreenHide: false,
    });
  });

  it('uses the shared inner tab id for offscreen preloaded webviews', () => {
    renderHook(useSyncActiveDappState, {
      initialProps: makeProps({ offscreenPreload: true }),
    });

    expect(getActiveDappState()).toMatchObject({
      tabId: INNER_GLOBAL_TAB_ID,
      isScreenHide: false,
    });
  });

  it('never overwrites the Browser tab from a hidden webview, even when it re-renders', () => {
    renderHook(useSyncActiveDappState, {
      initialProps: makeProps({ offscreenPreload: true }),
    });
    const { rerender } = renderHook(useSyncActiveDappState, {
      initialProps: makeProps({ webviewActive: false }),
    });
    openBrowserTab();

    rerender(makeProps({ webviewActive: false }));
    rerender(makeProps({ webviewActive: false }));

    expect(getActiveDappState()).toMatchObject({
      dappOrigin: POLYMARKET,
      tabId: BROWSER_TAB_ID,
      isScreenHide: false,
    });
  });

  it('does not take the state back from the Browser when an active webview re-renders', () => {
    const props = makeProps();
    const { rerender } = renderHook(useSyncActiveDappState, {
      initialProps: props,
    });
    openBrowserTab();

    rerender({ ...props });

    expect(getActiveDappState().tabId).toBe(BROWSER_TAB_ID);
    expect(getActiveDappState().isScreenHide).toBe(false);
  });

  it('hides its own state when it becomes inactive', () => {
    const props = makeProps();
    const { rerender } = renderHook(useSyncActiveDappState, {
      initialProps: props,
    });

    rerender({ ...props, webviewActive: false });

    expect(getActiveDappState()).toMatchObject({
      tabId: 'inner-webview',
      isScreenHide: true,
    });
  });

  it('leaves the Browser state alone when it becomes inactive after the Browser took over', () => {
    const props = makeProps();
    const { rerender, unmount } = renderHook(useSyncActiveDappState, {
      initialProps: props,
    });
    openBrowserTab();

    rerender({ ...props, webviewActive: false });
    unmount();

    expect(getActiveDappState()).toMatchObject({
      tabId: BROWSER_TAB_ID,
      isScreenHide: false,
    });
  });
});
