import { Linking } from 'react-native';

import {
  allowLinkOpen,
  getAlertMessage,
  isOrHasWithAllowedProtocol,
  parsePossibleURL,
  protocolAllowList,
  trustedProtocolToDeeplink,
} from '../dappView';

jest.mock('@/utils/url', () => ({
  isPossibleDomain: jest.fn((input: string) =>
    /^(?:\S(?:\S{0,61}\S)?\.)+\S{2,}$/.test(input),
  ),
}));

describe('dappView constants and helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps webview protocol allowlists stable', () => {
    expect(protocolAllowList).toEqual(['about:', 'http:', 'https:']);
    expect(trustedProtocolToDeeplink).toEqual([
      'wc:',
      'metamask:',
      'ethereum:',
      'dapp:',
    ]);
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
  });

  it('opens supported external links through React Native Linking', async () => {
    const canOpenURL = jest
      .spyOn(Linking, 'canOpenURL')
      .mockResolvedValueOnce(true);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce();

    await allowLinkOpen('https://rabby.io');

    expect(canOpenURL).toHaveBeenCalledWith('https://rabby.io');
    expect(openURL).toHaveBeenCalledWith('https://rabby.io');
  });

  it('warns when external links are unsupported or Linking throws', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(jest.fn());
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

    warnSpy.mockRestore();
  });
});
