import { Alert } from 'react-native';

import { allowLinkOpen } from '@/constant/dappView';
import {
  checkShouldStartLoadingWithRequestForDappWebView,
  checkShouldStartLoadingWithRequestForTrustedContent,
} from '../utils';

jest.mock('@/constant/dappView', () => ({
  protocolAllowList: ['about:', 'http:', 'https:'],
  trustedProtocolToDeeplink: ['wc:', 'metamask:', 'ethereum:', 'dapp:'],
  allowLinkOpen: jest.fn(),
  getAlertMessage: jest.fn((protocol: string) => {
    switch (protocol) {
      case 'blob:':
        return {
          needAlert: false,
          allowOpenLink: true,
          message: '',
        };
      case 'tel:':
        return {
          needAlert: true,
          allowOpenLink: false,
          message:
            'This website has been blocked from automatically making a phone call',
        };
      default:
        return {
          needAlert: true,
          allowOpenLink: false,
          message:
            'This website has been blocked from automatically opening an external application',
        };
    }
  }),
}));

describe('WebView utils', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  describe('checkShouldStartLoadingWithRequestForDappWebView', () => {
    it('allows normal web protocols to keep loading inside the dapp webview', () => {
      expect(
        checkShouldStartLoadingWithRequestForDappWebView({
          url: 'https://rabby.io',
        }),
      ).toBe(true);
      expect(allowLinkOpen).not.toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('opens trusted deeplink protocols externally and stops webview loading', () => {
      expect(
        checkShouldStartLoadingWithRequestForDappWebView({
          url: 'wc:topic@2?relay-protocol=irn',
        }),
      ).toBe(false);
      expect(allowLinkOpen).toHaveBeenCalledWith(
        'wc:topic@2?relay-protocol=irn',
      );
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('shows a warning alert for blocked external protocols and wires the allow action', () => {
      expect(
        checkShouldStartLoadingWithRequestForDappWebView({
          url: 'tel:123456',
        }),
      ).toBe(false);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Warning',
        'This website has been blocked from automatically making a phone call',
        expect.any(Array),
      );

      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      buttons[1].onPress();
      expect(allowLinkOpen).toHaveBeenCalledWith('tel:123456');
    });

    it('allows blob URLs without opening an alert', () => {
      expect(
        checkShouldStartLoadingWithRequestForDappWebView({
          url: 'blob:https://rabby.io/asset',
        }),
      ).toBe(true);
      expect(Alert.alert).not.toHaveBeenCalled();
      expect(allowLinkOpen).not.toHaveBeenCalled();
    });
  });

  describe('checkShouldStartLoadingWithRequestForTrustedContent', () => {
    it('opens known trusted content domains externally and stops webview loading', () => {
      expect(
        checkShouldStartLoadingWithRequestForTrustedContent({
          url: 'https://debank.com/profile',
        }),
      ).toBe(false);
      expect(allowLinkOpen).toHaveBeenCalledWith('https://debank.com/profile');
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('prompts before leaving trusted content to an untrusted https domain', () => {
      expect(
        checkShouldStartLoadingWithRequestForTrustedContent({
          url: 'https://example.com',
        }),
      ).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Warning',
        'This website has been blocked from automatically opening an external application',
        expect.any(Array),
      );

      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      buttons[1].onPress();
      expect(allowLinkOpen).toHaveBeenCalledWith('https://example.com');
    });
  });
});
