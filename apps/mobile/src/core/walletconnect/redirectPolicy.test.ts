import RNHelpers from '@/core/native/RNHelpers';
import { Linking } from 'react-native';
import {
  maybeRedirectToDapp,
  shouldAutoRedirectToDapp,
} from './redirectPolicy';
import {
  clearWalletConnectDappRedirectPending,
  markWalletConnectDappRedirectPending,
} from './redirectState';

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('@/core/native/RNHelpers', () => ({
  __esModule: true,
  default: {
    moveTaskToBack: jest.fn(),
  },
}));

jest.mock('@/core/native/utils', () => ({
  IS_ANDROID: true,
}));

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn(),
  },
}));

describe('walletconnect redirect policy', () => {
  beforeEach(() => {
    clearWalletConnectDappRedirectPending();
    jest.mocked(RNHelpers.moveTaskToBack).mockReset();
    jest.mocked(Linking.openURL).mockReset();
  });

  it('only auto redirects deep-link initiated connections', () => {
    expect(shouldAutoRedirectToDapp('deeplink')).toBe(true);
    expect(shouldAutoRedirectToDapp('qr')).toBe(false);
    expect(shouldAutoRedirectToDapp('manual')).toBe(false);
  });

  it('moves the Android task to the back for deep-link initiated approvals', async () => {
    jest.mocked(RNHelpers.moveTaskToBack).mockResolvedValue(true);

    await expect(
      maybeRedirectToDapp({
        source: 'deeplink',
      }),
    ).resolves.toBe(true);

    expect(RNHelpers.moveTaskToBack).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('does not redirect manual or QR initiated approvals', async () => {
    await expect(
      maybeRedirectToDapp({
        source: 'qr',
        nativeRedirect: 'example://walletconnect',
      }),
    ).resolves.toBe(false);

    expect(RNHelpers.moveTaskToBack).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('uses native redirect as a fallback when Android task move fails', async () => {
    jest
      .mocked(RNHelpers.moveTaskToBack)
      .mockRejectedValue(new Error('activity missing'));
    jest.mocked(Linking.openURL).mockResolvedValue(undefined);

    await expect(
      maybeRedirectToDapp({
        source: 'deeplink',
        nativeRedirect: 'example://walletconnect',
      }),
    ).resolves.toBe(true);

    expect(Linking.openURL).toHaveBeenCalledWith('example://walletconnect');
  });

  it('consumes pending WalletConnect redirect markers', async () => {
    markWalletConnectDappRedirectPending();
    jest.mocked(RNHelpers.moveTaskToBack).mockResolvedValue(true);

    await expect(maybeRedirectToDapp({})).resolves.toBe(true);
    await expect(maybeRedirectToDapp({})).resolves.toBe(false);

    expect(RNHelpers.moveTaskToBack).toHaveBeenCalledTimes(1);
  });
});
