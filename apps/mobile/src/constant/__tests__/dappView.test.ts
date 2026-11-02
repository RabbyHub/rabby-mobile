import { Linking } from 'react-native';

import {
  allowLinkOpen,
  getAlertMessage,
  isOrHasWithAllowedProtocol,
  parsePossibleURL,
  protocolAllowList,
  trustedProtocolToDeeplink,
} from '../dappView';

describe('dappView constants and helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps webview protocol allowlists stable', () => {
    expect(protocolAllowList).toEqual(['about:', 'http:', 'https:']);
    expect(trustedProtocolToDeeplink).toEqual(['wc:', 'ethereum:', 'dapp:']);
  });

  it('checks direct protocols and URLs for webview-allowed protocols', () => {
    expect(isOrHasWithAllowedProtocol()).toBe(false);
    expect(isOrHasWithAllowedProtocol('https:')).toBe(true);
    expect(isOrHasWithAllowedProtocol('https://rabby.io')).toBe(true);
    expect(isOrHasWithAllowedProtocol('wc:topic@2')).toBe(false);
  });

  it('parses possible domain input into https URLs and rejects unsupported protocols', () => {
    expect(parsePossibleURL(' rabby.io ')).toBe('https://rabby.io');
    expect(parsePossibleURL('')).toBe(null);
    expect(parsePossibleURL('wc:topic@2')).toBe(null);
    expect(parsePossibleURL('not a domain')).toBeUndefined();
  });

  it('returns expected alert decisions by protocol', () => {
    expect(getAlertMessage('tel:')).toEqual({
      needAlert: true,
      allowOpenLink: false,
      message:
        'This website has been blocked from automatically making a phone call',
    });
    expect(getAlertMessage('mailto:')).toEqual({
      needAlert: true,
      allowOpenLink: false,
      message:
        'This website has been blocked from automatically composing an email.',
    });
    expect(getAlertMessage('blob:')).toEqual({
      needAlert: false,
      allowOpenLink: true,
      message: '',
    });
    expect(getAlertMessage('unknown:')).toEqual({
      needAlert: true,
      allowOpenLink: false,
      message:
        'This website has been blocked from automatically opening an external application',
    });
    expect(getAlertMessage('metamask:')).toEqual({
      needAlert: true,
      allowOpenLink: false,
      message:
        'This website has been blocked from automatically opening an external application',
    });
  });

  it('opens supported external links through React Native Linking', async () => {
    const canOpenURL = jest
      .spyOn(Linking, 'canOpenURL')
      .mockResolvedValueOnce(true);
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValueOnce(undefined);

    await allowLinkOpen('https://rabby.io');

    expect(canOpenURL).toHaveBeenCalledWith('https://rabby.io');
    expect(openURL).toHaveBeenCalledWith('https://rabby.io');
  });

  it('does not query or open external links when the caller is inactive', async () => {
    const canOpenURL = jest.spyOn(Linking, 'canOpenURL');
    const openURL = jest.spyOn(Linking, 'openURL');

    await expect(
      allowLinkOpen('metamask://wc', () => false),
    ).resolves.toBeNull();

    expect(canOpenURL).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('rechecks caller activity after the native capability query resolves', async () => {
    let isActive = true;
    let resolveSupported!: (supported: boolean) => void;
    const supported = new Promise<boolean>(resolve => {
      resolveSupported = resolve;
    });
    const canOpenURL = jest
      .spyOn(Linking, 'canOpenURL')
      .mockReturnValueOnce(supported);
    const openURL = jest.spyOn(Linking, 'openURL');

    const opening = allowLinkOpen('metamask://wc', () => isActive);
    expect(canOpenURL).toHaveBeenCalledWith('metamask://wc');

    isActive = false;
    resolveSupported(true);
    await opening;

    expect(openURL).not.toHaveBeenCalled();
  });

  it('warns when external links are unsupported or Linking throws', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(jest.fn());
    const openURL = jest.spyOn(Linking, 'openURL');
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(false);

    await expect(allowLinkOpen('unsupported:link')).resolves.toBe(null);
    expect(warnSpy).toHaveBeenCalledWith("Can't open url: unsupported:link");

    (Linking.canOpenURL as jest.Mock).mockRejectedValueOnce(
      new Error('linking failed'),
    );
    await allowLinkOpen('https://rabby.io');
    expect(warnSpy).toHaveBeenCalledWith(
      'Error opening URL: Error: linking failed',
    );
    expect(openURL).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
